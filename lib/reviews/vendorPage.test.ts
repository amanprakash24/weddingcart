/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toVenueView } from '@/lib/listing/venueView';
import { toVendorView } from '@/lib/listing/vendorView';

// Roadmap 1.4 decision (03/10/2026): couples' verified reviews are kept apart from the hand-entered online rating and never blended.
// Checked on the listing pages (venues and every other category, 19 Nov 2026) so the rule can't quietly drift.
const pages = ['VenuePage.tsx', 'VendorListingPage.tsx'].map((f) => [f, readFileSync(join(import.meta.dir, '..', '..', 'components', 'listing', f), 'utf8')] as const);

describe.each(pages)('%s — online rating vs couple reviews', (_name, src) => {
  test('both kinds are labelled, couple reviews shown first, the online rating only when it has a count', () => {
    expect(src).toContain('ONLINE_RATING_LABEL');
    expect(src).toContain('VERIFIED_REVIEWS_LABEL');
    expect(src).toMatch(/verified\?\.summary \? \([\s\S]*?\) : v\.onlineRating \?/);
  });

  test('couple reviews are never added to the online rating or its count', () => {
    expect(src).not.toMatch(/reviewCount\s*\+|\+\s*[\w.]*reviewCount|verified[^;\n]*onlineRating\.value|onlineRating\.value[^;\n]*verified/);
  });
});

test('no online rating without reviews (the 4.5 default is not a rating)', () => {
  expect(toVenueView({ slug: 's', name: 'n', city: 'Patna', priceMin: 0, priceMax: 0, rating: 4.5, reviewCount: 0 }).onlineRating).toBeNull();
  expect(toVendorView({ slug: 's', name: 'n', category: 'dj', city: 'Patna', priceMin: 0, priceMax: 0, rating: 4.5, reviewCount: 0 }).onlineRating).toBeNull();
});
