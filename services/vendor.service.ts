import { vendorRepository } from '@/repositories/vendor.repository';
import { categoryRepository } from '@/repositories/category.repository';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { generateUniqueVendorSlug } from '@/lib/slug';
import type { Prisma, VendorStatus } from '@/generated/prisma/client';

export interface VendorPackageInput {
  name: string;
  description: string;
  price: number;
  features?: string[];
  isPopular?: boolean;
  image?: string;
}

export interface VendorFaqInput {
  question: string;
  answer: string;
}

export interface VendorSearchParams {
  category?: string; // Category slug, e.g. "venue" — matches the current /api/vendors query param
  city?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  featured?: boolean;
  status?: VendorStatus | VendorStatus[]; // caller (route) decides the value; anonymous requests must always be forced to PUBLISHED there, not here
  sort?: 'rating' | 'price-asc' | 'price-desc' | 'reviews';
  skip?: number;
  take?: number;
}

// Vendor create input from the admin form — `slug` is deliberately absent:
// it's always derived server-side from name+city (see create() below), never
// accepted from the client, matching the "no manual SEO fields" requirement.
export interface VendorCreateData {
  name: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  categoryId: string;
  city: string;
  address?: string;
  mapEmbedUrl?: string;
  priceMin: number;
  priceMax: number;
  guestCapacity?: number;
  venueType?: string;
  image: string;
  images?: string[];
  virtualTourVideo?: string;
  description: string;
  features?: string[];
  isFeatured?: boolean;
  status?: VendorStatus;
}

// Mirrors current /api/vendors GET filtering/sorting exactly (see
// docs/postgres-migration-plan.md migration mapping) — same defaults, same
// sort tie-breakers, so swapping the route handler over later is a pure
// plumbing change, not a behavior change.
function buildWhere(params: VendorSearchParams): Prisma.VendorWhereInput {
  const where: Prisma.VendorWhereInput = {};

  if (params.category) where.category = { slug: params.category };
  if (params.city) where.city = params.city;
  if (params.featured) where.isFeatured = true;
  if (params.status) where.status = Array.isArray(params.status) ? { in: params.status } : params.status;
  if (params.minRating !== undefined) where.rating = { gte: params.minRating };
  if (params.minPrice !== undefined) where.priceMin = { gte: params.minPrice };
  if (params.maxPrice !== undefined) where.priceMax = { lte: params.maxPrice };
  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { city: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

function buildOrderBy(sort: VendorSearchParams['sort']): Prisma.VendorOrderByWithRelationInput[] {
  switch (sort) {
    case 'price-asc':
      return [{ sortOrder: 'asc' }, { isFeatured: 'desc' }, { priceMin: 'asc' }];
    case 'price-desc':
      return [{ sortOrder: 'asc' }, { isFeatured: 'desc' }, { priceMin: 'desc' }];
    case 'reviews':
      return [{ sortOrder: 'asc' }, { isFeatured: 'desc' }, { reviewCount: 'desc' }, { rating: 'desc' }];
    default:
      return [{ sortOrder: 'asc' }, { isFeatured: 'desc' }, { rating: 'desc' }, { reviewCount: 'desc' }];
  }
}

export const vendorService = {
  getBySlug: vendorRepository.findBySlug,

  // Composes across two repositories (Vendor + Category) — per
  // docs/architecture/repository-contract.md this belongs in the service, not
  // the repository ("Repository → Repository" composition is disallowed).
  // Returns the real Category relation as-is; flattening it to a slug string
  // for the admin frontend contract is a response-shaping concern and happens
  // in the route handler instead.
  // Public vendor URLs (and every client-side re-fetch off them —
  // VendorDetailClient, VendorPortfolioClient) pass the slug, not the Prisma
  // id (see schema.prisma's note on Vendor.slug). Falls back to a slug
  // lookup so GET /api/vendors/[id] resolves both; admin's real-id calls
  // still short-circuit on the first branch, unchanged.
  async getById(id: string) {
    const vendor = await vendorRepository.findById(id) ?? await vendorRepository.findBySlug(id);
    if (!vendor) return null;
    const category = await categoryRepository.findById(vendor.categoryId);
    return { ...vendor, category };
  },

  async search(params: VendorSearchParams) {
    return vendorRepository.findMany({
      where: buildWhere(params),
      orderBy: buildOrderBy(params.sort),
      skip: params.skip,
      take: params.take,
    });
  },

  // Slug is always derived server-side (name+city, collision-checked) —
  // never accepted from the client. Fixes a confirmed bug in the old
  // AdminClient.tsx vendor-create form, which posted an `id` field the API
  // never read, so `slug` (required, unique) arrived undefined.
  async create(data: VendorCreateData) {
    const slug = await generateUniqueVendorSlug(data.name, data.city, (candidate) => vendorRepository.slugExists(candidate));

    return vendorRepository.create({
      slug,
      name: data.name,
      ownerName: data.ownerName,
      ownerPhone: data.ownerPhone,
      ownerEmail: data.ownerEmail,
      category: { connect: { id: data.categoryId } },
      city: data.city,
      address: data.address,
      mapEmbedUrl: data.mapEmbedUrl,
      priceMin: data.priceMin,
      priceMax: data.priceMax,
      guestCapacity: data.guestCapacity,
      venueType: data.venueType,
      image: data.image,
      images: data.images ?? [],
      virtualTourVideo: data.virtualTourVideo,
      description: data.description,
      features: data.features ?? [],
      isFeatured: data.isFeatured ?? false,
      status: data.status ?? 'DRAFT',
    });
  },

  // Packages and FAQs are each a full replace (deleteMany + createMany),
  // matching the old Mongoose embedded-array semantics where the admin form
  // always submits the complete list, not a diff. Wrapped in a transaction
  // per repository-contract.md ("which layer owns transactions? Services.")
  // so a failure in any part leaves nothing applied.
  async update(
    id: string,
    data: Prisma.VendorUpdateInput,
    relations?: { packages?: VendorPackageInput[]; faqs?: VendorFaqInput[] }
  ) {
    return prisma.$transaction(async (tx) => {
      // Pre-check the category exists before attempting the nested connect.
      // Prisma's own P2025 for a failed nested connect never carries the
      // attempted value, and vendorRepository.update wraps everything in
      // withPrismaErrors('Vendor', ...), so left alone it surfaces as a
      // misleading "Vendor not found: unknown" even though the vendor exists
      // and it's the category that's missing. This doesn't change behavior
      // for a valid category — one extra indexed lookup by unique slug,
      // inside the same transaction, before any write.
      const categorySlug = data.category?.connect?.slug;
      if (categorySlug !== undefined) {
        const category = await categoryRepository.findBySlug(categorySlug, tx);
        if (!category) throw new NotFoundError('Category', categorySlug);
      }

      const vendor = await vendorRepository.update(id, data, tx);

      const { packages, faqs } = relations ?? {};
      if (packages) {
        await tx.vendorPackage.deleteMany({ where: { vendorId: id } });
        if (packages.length) {
          await tx.vendorPackage.createMany({
            data: packages.map((p) => ({
              vendorId: id,
              name: p.name,
              description: p.description,
              price: p.price,
              features: p.features ?? [],
              isPopular: p.isPopular ?? false,
              image: p.image ?? '',
            })),
          });
        }
      }
      if (faqs) {
        await tx.vendorFaq.deleteMany({ where: { vendorId: id } });
        if (faqs.length) {
          await tx.vendorFaq.createMany({
            data: faqs.map((f) => ({ vendorId: id, question: f.question, answer: f.answer })),
          });
        }
      }

      return vendor;
    });
  },

  delete: vendorRepository.delete,
};
