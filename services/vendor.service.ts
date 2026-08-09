import { vendorRepository } from '@/repositories/vendor.repository';
import { categoryRepository } from '@/repositories/category.repository';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import type { Prisma } from '@/generated/prisma/client';

export interface VendorPackageInput {
  name: string;
  description: string;
  price: number;
  features?: string[];
  isPopular?: boolean;
  image?: string;
}

export interface VendorSearchParams {
  category?: string; // Category slug, e.g. "venue" — matches the current /api/vendors query param
  city?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  featured?: boolean;
  sort?: 'rating' | 'price-asc' | 'price-desc' | 'reviews';
  skip?: number;
  take?: number;
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
  async getById(id: string) {
    const vendor = await vendorRepository.findById(id);
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

  create: vendorRepository.create,

  // Packages are a full replace (deleteMany + createMany), matching the old
  // Mongoose embedded-array semantics where the admin form always submits the
  // complete package list, not a diff. Wrapped in a transaction per
  // repository-contract.md ("which layer owns transactions? Services.") so a
  // failure in either half leaves neither applied. FAQs are untouched — the
  // admin vendor form has no FAQ fields.
  async update(id: string, data: Prisma.VendorUpdateInput, packages?: VendorPackageInput[]) {
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
      return vendor;
    });
  },

  delete: vendorRepository.delete,
};
