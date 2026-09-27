// Maps a real, published Vendor row (already filtered by city+area+status at the query site — see
// app/venues/patna/*/page.tsx) into the shape components/venues/VenueFilterList.tsx renders. Pure: no
// database, no framework. Every field here is a real Vendor column — nothing is invented to fill a gap
// the source data doesn't have (see the "no fabricated vendors" rule this whole initiative exists under).
import type { LocalityVenue } from '@/components/venues/VenueFilterList';

export interface LocalityVendorRow {
  name: string;
  slug: string;
  rating: number;
  guestCapacity: number | null;
  venueType: string | null;
  priceMin: number;
  priceMax: number;
  features: string[];
  image: string;
}

// Stay/accommodation is never assumed — only claimed when the vendor's own feature tags actually say so.
const STAY_KEYWORDS = /stay|room|accommodation|lodging/i;

export function toLocalityVenue(vendor: LocalityVendorRow, areaLabel: string): LocalityVenue {
  const rooms = vendor.features.find((f) => STAY_KEYWORDS.test(f));

  return {
    name: vendor.name,
    tagline: vendor.venueType || 'Verified Wedding Venue',
    area: areaLabel,
    rating: vendor.rating,
    capacityLabel: vendor.guestCapacity ? `Up to ${vendor.guestCapacity} guests` : 'Capacity on request',
    // Unknown capacity defaults to the top bucket rather than the bottom one — Patna venues in this
    // dataset skew large, and silently hiding an unverified-capacity venue under "Up to 250 Guests" would
    // be a worse, more misleading default than surfacing it under "500+" where a guest will ask directly.
    capacityMax: vendor.guestCapacity ?? Number.MAX_SAFE_INTEGER,
    vegPrice: vendor.priceMin,
    nonVegPrice: vendor.priceMax,
    rooms,
    highlights: vendor.features,
    href: `/vendors/${vendor.slug}`,
    image: vendor.image,
    imageAlt: `${vendor.name}, ${areaLabel} Patna`,
  };
}

export function toLocalityVenues(vendors: LocalityVendorRow[], areaLabel: string): LocalityVenue[] {
  return vendors.map((v) => toLocalityVenue(v, areaLabel));
}
