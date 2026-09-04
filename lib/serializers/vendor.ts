import { categoryRepository } from '@/repositories/category.repository';
import type { VendorWithRelations } from '@/repositories/vendor.repository';
import type { Vendor, CategoryType } from '@/types';

// Public pages and their client components (VendorCard, VendorDetailClient,
// VendorPortfolioClient, CityPageClient, CategoryPageClient) were all built
// against the Mongo-era `Vendor` shape: `id` is the human-readable slug (not
// Prisma's UUID `id`), `category` is a flat slug string (not a relation),
// and `faqs` uses `{q, a}` (Prisma's VendorFaq uses `question`/`answer`).
// This is the single place that shape gets produced, so every page maps
// vendors the same way rather than six slightly-different inline mappings.
export function toLegacyVendor(vendor: VendorWithRelations, categorySlug: string): Vendor {
  return {
    id: vendor.slug,
    name: vendor.name,
    ownerName: vendor.ownerName || undefined,
    ownerPhone: vendor.ownerPhone || undefined,
    ownerEmail: vendor.ownerEmail || undefined,
    category: categorySlug as CategoryType,
    city: vendor.city,
    priceMin: vendor.priceMin,
    priceMax: vendor.priceMax,
    rating: vendor.rating,
    reviewCount: vendor.reviewCount,
    image: vendor.image,
    images: vendor.images,
    virtualTourVideo: vendor.virtualTourVideo || undefined,
    description: vendor.description,
    features: vendor.features,
    packages: vendor.packages.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      features: p.features,
      isPopular: p.isPopular,
      isPerPlate: p.isPerPlate,
      image: p.image || undefined,
    })),
    isFeatured: vendor.isFeatured,
    address: vendor.address || undefined,
    mapEmbedUrl: vendor.mapEmbedUrl || undefined,
    faqs: vendor.faqs.map((f) => ({ q: f.question, a: f.answer })),
  };
}

// Batch-resolves categoryId -> slug for a set of vendors in one query,
// avoiding an N+1 category lookup per vendor on listing pages.
export async function resolveCategorySlugs(categoryIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(categoryIds)];
  if (uniqueIds.length === 0) return new Map();
  const { data } = await categoryRepository.findMany({ where: { id: { in: uniqueIds } } });
  return new Map(data.map((c) => [c.id, c.slug]));
}

export async function toLegacyVendors(vendors: VendorWithRelations[]): Promise<Vendor[]> {
  const categorySlugs = await resolveCategorySlugs(vendors.map((v) => v.categoryId));
  return vendors.map((v) => toLegacyVendor(v, categorySlugs.get(v.categoryId) ?? ''));
}
