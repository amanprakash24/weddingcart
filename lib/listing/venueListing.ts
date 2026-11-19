import type { VendorWithRelations } from '@/repositories/vendor.repository';
import type { VenueListing } from './venueView';

// A saved vendor row as the master venue page reads it (lib/listing/venueView.ts). Public fields only: no owner contact.
export function toListing(row: VendorWithRelations): VenueListing {
  return {
    slug: row.slug,
    name: row.name,
    city: row.city,
    address: row.address,
    area: row.area,
    venueType: row.venueType,
    guestCapacity: row.guestCapacity,
    priceMin: row.priceMin,
    priceMax: row.priceMax,
    priceUnit: row.priceUnit,
    rating: row.rating,
    reviewCount: row.reviewCount,
    image: row.image,
    images: row.images,
    virtualTourVideo: row.virtualTourVideo,
    description: row.description,
    features: row.features,
    packages: row.packages.map((p) => ({ id: p.id, name: p.name, price: p.price, features: p.features, isPerPlate: p.isPerPlate })),
    faqs: row.faqs.map((f) => ({ q: f.question, a: f.answer })),
    mapEmbedUrl: row.mapEmbedUrl,
  };
}
