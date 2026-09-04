import {
  vendorApplicationRepository,
  type VendorApplicationWithCategory,
} from '@/repositories/vendorApplication.repository';
import { categoryRepository } from '@/repositories/category.repository';
import { vendorRepository } from '@/repositories/vendor.repository';
import { prisma } from '@/lib/prisma';
import { NotFoundError, DuplicateError } from '@/lib/errors';
import { slugify } from '@/lib/slug';
import { Role } from '@/lib/auth/roles';
import type { ApplicationStatus, Prisma } from '@/generated/prisma/client';

type Tx = Prisma.TransactionClient;

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80';

export interface VendorApplicationCreateData {
  businessName: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  category: string; // real Category id — VendorOnboardingClient.tsx's <select> already submits categories[].id
  city: string;
  priceMin?: number;
  priceMax?: number;
  experience?: string;
  description?: string;
  instagram?: string;
  website?: string;
  coverImage?: string;
  portfolioImages?: string[];
  foodMenuImages?: string[];
}

// Cross-repository composition (VendorApplication + Category + Vendor) — per
// docs/architecture/architecture-review.md's own named example,
// approveVendorApplication() belongs in the service, not the route.
//
// Fixes a currently-live bug: the old Mongo route created the approved
// vendor in MongoDB, which is invisible everywhere the rest of the app now
// reads from Postgres (admin vendor list/edit, search, city/category
// pages). This creates a real Prisma Vendor instead, linked through the
// schema's own vendorId FK.
//
// The generated slug uses the category's real slug (e.g. "venue") rather
// than the old Mongo code's literal `${app.category}` — today that value is
// actually a raw Category UUID (the onboarding form submits categories[].id,
// not a readable string), so preserving it byte-for-byte would embed a UUID
// in every newly-generated vendor slug. Using category.slug is a strict
// improvement with no contract to preserve — this string was never exposed
// to any caller, just generated fresh at approval time.
async function approveVendorApplication(app: VendorApplicationWithCategory, tx: Tx) {
  const slug = `${app.category.slug}-${slugify(app.businessName)}-${Date.now()}`;

  const features: string[] = [];
  if (app.experience) features.push(`${app.experience} of experience`);
  if (app.instagram) features.push(`Instagram: ${app.instagram}`);
  if (app.website) features.push(`Website: ${app.website}`);

  return vendorRepository.create({
    slug,
    name: app.businessName,
    ownerName: app.ownerName,
    ownerPhone: app.ownerPhone,
    ownerEmail: app.ownerEmail,
    category: { connect: { id: app.categoryId } },
    city: app.city,
    priceMin: app.priceMin,
    priceMax: app.priceMax,
    // Explicit, not the Prisma default (4.5) — a freshly-onboarded, unproven
    // vendor starts unrated, matching the original Mongo behavior exactly.
    rating: 0,
    reviewCount: 0,
    image: app.coverImage || DEFAULT_IMAGE,
    images: app.coverImage ? [app.coverImage] : [DEFAULT_IMAGE],
    description: app.description || `${app.businessName} — a verified ShaadiShopping vendor.`,
    features,
    // Explicit, not the Vendor.status column default (DRAFT) — approving an
    // application already IS this flow's review step, so the resulting
    // vendor should go live immediately, matching pre-status-field behavior,
    // not sit in Draft awaiting a second separate publish action.
    status: 'PUBLISHED',
  }, tx);
}

// Links the approved vendor's phone number to a real login: find-or-create
// the User, add VENDOR to their roles (existing roles — e.g. CUSTOMER, if
// this phone already booked their own wedding — are left untouched, since
// one phone can hold multiple roles per the Step 4 schema review), and
// create the VendorProfile that ties that login to this Vendor. Runs inside
// the same transaction as the Vendor creation and application update, so a
// partial failure never leaves an orphaned Vendor or a stuck application.
async function provisionVendorAccount(ownerPhone: string, vendorId: string, tx: Tx) {
  const user = await tx.user.findUnique({
    where: { phone: ownerPhone },
    include: { vendorProfile: true },
  });

  // Never reassign an existing VendorProfile to a different vendor — fail
  // safely (rolls back the whole transaction) instead of silently changing
  // who this phone number logs in as.
  if (user?.vendorProfile && user.vendorProfile.vendorId !== vendorId) {
    throw new DuplicateError('VendorProfile', 'phone');
  }

  const resolvedUser = user ?? (await tx.user.create({ data: { phone: ownerPhone } }));

  await tx.userRole.upsert({
    where: { userId_role: { userId: resolvedUser.id, role: Role.VENDOR } },
    create: { userId: resolvedUser.id, role: Role.VENDOR },
    update: {},
  });

  if (!user?.vendorProfile) {
    await tx.vendorProfile.create({ data: { userId: resolvedUser.id, vendorId } });
  }
}

export const vendorApplicationService = {
  async list(params: { status?: ApplicationStatus }) {
    return vendorApplicationRepository.findMany({
      where: params.status ? { status: params.status } : {},
      orderBy: { createdAt: 'desc' },
    });
  },

  getById: vendorApplicationRepository.findById,

  // category is submitted as a real Category id already (see
  // VendorApplicationCreateData) — pre-checked here for a clean 404 instead
  // of Prisma's generic nested-connect error, same pattern as the
  // Vendor.category / Enquiry.vendor fixes.
  async create(data: VendorApplicationCreateData) {
    const category = await categoryRepository.findById(data.category);
    if (!category) throw new NotFoundError('Category', data.category);

    return vendorApplicationRepository.create({
      businessName: data.businessName,
      ownerName: data.ownerName,
      ownerPhone: data.ownerPhone,
      ownerEmail: data.ownerEmail,
      category: { connect: { id: data.category } },
      city: data.city,
      priceMin: data.priceMin,
      priceMax: data.priceMax,
      experience: data.experience,
      description: data.description,
      instagram: data.instagram,
      website: data.website,
      coverImage: data.coverImage,
      portfolioImages: data.portfolioImages,
      foodMenuImages: data.foodMenuImages,
    });
  },

  // Auto-creates the Vendor + login account on the FIRST transition to
  // APPROVED only — mirrors the old Mongo guard (status transitioning + no
  // vendorId yet) exactly, so re-approving or re-saving never creates a
  // duplicate Vendor, User, or VendorProfile.
  async updateStatus(id: string, status: ApplicationStatus) {
    const existing = await vendorApplicationRepository.findById(id);
    if (!existing) return null;

    const shouldProvision = status === 'APPROVED' && existing.status !== 'APPROVED' && !existing.vendorId;
    if (!shouldProvision) {
      return vendorApplicationRepository.update(id, { status });
    }

    // Vendor creation, user/role/profile provisioning, and the application's
    // own status+vendorId update all happen in one transaction — a failure
    // in any part (e.g. this phone is already linked to a different vendor)
    // rolls everything back, so nothing is left orphaned or half-approved.
    return prisma.$transaction(async (tx) => {
      const vendor = await approveVendorApplication(existing, tx);
      await provisionVendorAccount(existing.ownerPhone, vendor.id, tx);
      return vendorApplicationRepository.update(id, { status, vendor: { connect: { id: vendor.id } } }, tx);
    });
  },

  delete: (id: string) => vendorApplicationRepository.delete(id),
};
