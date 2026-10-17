import { describe, expect, test } from 'bun:test';
import { buildCategoryTiles, categoryHref } from './categoryTiles';

const CATS = [
  { slug: 'venue', name: 'Wedding Venues' },
  { slug: 'decorator', name: 'Decorators' },
  { slug: 'security', name: 'Security' },
  { slug: 'photo-video', name: 'Photo & Video' },
  { slug: 'sherwani', name: 'Sherwani' },
];

describe('buildCategoryTiles', () => {
  test('only services with published vendors, with real counts', () => {
    const tiles = buildCategoryTiles(['venue', 'venue', 'decorator', 'security'], CATS);
    expect(tiles.map((t) => [t.slug, t.count])).toEqual([['venue', 2], ['decorator', 1], ['security', 1]]);
  });
  test('planning order first, then the rest', () => {
    const tiles = buildCategoryTiles(['security', 'security', 'photo-video', 'venue'], CATS);
    expect(tiles.map((t) => t.slug)).toEqual(['venue', 'photo-video', 'security']);
  });
  test('unknown or empty category slugs are ignored', () => {
    expect(buildCategoryTiles(['', 'not-a-category'], CATS)).toEqual([]);
  });
  test('links to the Patna page where one exists', () => {
    expect(categoryHref('venue')).toBe('/cities/patna/venue');
    expect(categoryHref('sherwani')).toBe('/categories/sherwani');
  });
  test('pictures only from /public, none for others', () => {
    const tiles = buildCategoryTiles(['venue', 'security'], CATS);
    expect(tiles[0].picture).toBe('/cat-venue-guides.jpg');
    expect(tiles[1].picture).toBeNull();
  });
  test('capped', () => {
    expect(buildCategoryTiles(['venue', 'decorator', 'security'], CATS, 2)).toHaveLength(2);
  });
});
