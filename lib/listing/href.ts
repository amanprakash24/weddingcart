// One rule for a listing's web address, used everywhere the site links to a venue or vendor.
// Venues live at /venues/<slug> (the master venue page, 19 Nov 2026); every other category stays at /vendors/<slug>.
// Old /vendors/<venue-slug> links forward permanently to /venues/<slug> (app/vendors/[id]/page.tsx, next.config.ts).

export function listingPath(listing: { slug?: string | null; id?: string | null; category?: string | null }): string {
  const key = listing.slug || listing.id || '';
  return listing.category === 'venue' ? `/venues/${key}` : `/vendors/${key}`;
}
