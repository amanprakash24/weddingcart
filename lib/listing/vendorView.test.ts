/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { toVendorView, isOwnContactLine } from './vendorView';
import { templateFor, CATEGORY_TEMPLATES } from './categoryTemplates';

// Shaped like the live listings on 19 Nov 2026.
const amit = {
  slug: 'decorator-amit-events-and-decorations-1791304104364', name: 'Amit Events and Decorations', category: 'decorator', city: 'Patna',
  priceMin: 25000, priceMax: 1000000, rating: 4.5, reviewCount: 0, image: 'a.jpg', images: ['a.jpg', 'b.jpg', 'c.jpg'],
  description: 'Wedding decoration in Patna.', features: ['10+ years of experience', 'Website: https://amitdecoration.com/'],
};

describe('toVendorView', () => {
  const v = toVendorView(amit);
  test('the vendor’s own website never reaches the page', () => {
    expect(v.features).toEqual([]);
    expect(JSON.stringify(v)).not.toContain('amitdecoration.com');
  });
  test('experience becomes a fact; starting price; photos counted once', () => {
    expect(v.facts).toEqual([
      { label: 'Starting price', value: '₹25,000' },
      { label: 'Experience', value: '10+ years' },
      { label: 'Photos', value: '3' },
    ]);
  });
  test('the decorator template', () => {
    expect(v.template.label).toBe('Wedding decorator');
    expect(v.template.order[0]).toBe('gallery');
  });
  test('no rating shown without reviews (the 4.5 default is not a rating)', () => expect(v.onlineRating).toBeNull());

  test('a caterer shows menus first, per plate', () => {
    const c = toVendorView({ slug: 'c', name: 'C', category: 'catering', city: 'Patna', priceMin: 450, priceMax: 900, rating: 0, reviewCount: 0,
      packages: [{ id: 'm', name: 'Veg menu', price: 450, features: ['₹450 per plate', 'Paneer, dal, 2 sabzi'] }] });
    expect(c.template.order[0]).toBe('packages');
    expect(c.facts[0]).toEqual({ label: 'Starting price', value: '₹450 / plate' });
    expect(c.packages[0]).toEqual({ id: 'm', name: 'Veg menu', price: '₹450', unit: '/ plate', points: ['Paneer, dal, 2 sabzi'] });
  });

  test('nothing saved: no blanks, nothing invented', () => {
    const e = toVendorView({ slug: 'e', name: 'E', category: 'unknown-thing', city: 'Patna', priceMin: 0, priceMax: 0, rating: 4.5, reviewCount: 0 });
    expect(e.facts).toEqual([{ label: 'Starting price', value: 'Ask us' }]);
    expect(e.template.label).toBe('Wedding service');
    expect(e.photos).toEqual([]);
  });
});

describe('own-contact lines', () => {
  test.each(['Website: https://x.com', 'Instagram: @the_instastudio ', 'Instagram: Rdad_prvitatelimited', 'Call 9876543210', 'mail me a@b.in', 'www.example.com'])('hidden: %s', (l) => expect(isOwnContactLine(l)).toBe(true));
  test.each(['10+ years of experience', 'Drone coverage', 'Candid and traditional', 'Same-day edit @ extra cost'])('kept: %s', (l) => expect(isOwnContactLine(l)).toBe(false));
});

describe('templates', () => {
  test('every named category has the three sections exactly once', () => {
    for (const t of Object.values(CATEGORY_TEMPLATES)) expect([...t.order].sort()).toEqual(['features', 'gallery', 'packages']);
  });
  test('known extra categories get their own name on the shared design', () => expect(templateFor('security').label).toBe('Security guards and bouncers'));
});
