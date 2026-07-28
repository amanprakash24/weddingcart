import { vendorRepository } from '@/repositories/vendor.repository';
import type { Prisma } from '@/generated/prisma/client';

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
  getById: vendorRepository.findById,
  getBySlug: vendorRepository.findBySlug,

  async search(params: VendorSearchParams) {
    return vendorRepository.findMany({
      where: buildWhere(params),
      orderBy: buildOrderBy(params.sort),
      skip: params.skip,
      take: params.take,
    });
  },

  create: vendorRepository.create,
  update: vendorRepository.update,
  delete: vendorRepository.delete,
};
