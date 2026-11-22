// The four products (the founder's naming, 11 Nov 2026):
//   Vivah OS  — Shaadi Shopping and its team (/admin)
//   Venue OS  — a venue, and the vendors it works with
//   Vendor OS — photographers, DJs, bands, decorators, bouncers and other wedding businesses
//   Client OS — the couple and their family (My Wedding)
// Venue OS and Vendor OS are the same screens (/vendor/*); which name a business sees follows its listing category.
import { isVenueCategory } from '@/lib/quotation/terms';

export type Product = 'VIVAH' | 'VENUE' | 'VENDOR' | 'CLIENT';

export const PRODUCT_NAME: Record<Product, string> = {
  VIVAH: 'Vivah OS',
  VENUE: 'Venue OS',
  VENDOR: 'Vendor OS',
  CLIENT: 'Client OS',
};

// The first word of the logo (set in type next to the mandap mark): VIVAH / VENUE / VENDOR / CLIENT.
export const PRODUCT_WORD: Record<Product, string> = { VIVAH: 'VIVAH', VENUE: 'VENUE', VENDOR: 'VENDOR', CLIENT: 'CLIENT' };

/** Which product a business works in: Shaadi Shopping's own → Vivah OS; a venue category → Venue OS; anything else → Vendor OS. */
export function productOfBusiness(kind: 'PLATFORM' | 'VENDOR', categoryName: string | null | undefined): Product {
  if (kind === 'PLATFORM') return 'VIVAH';
  return categoryName && isVenueCategory(categoryName) ? 'VENUE' : 'VENDOR';
}
