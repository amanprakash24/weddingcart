/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { listingPath } from './href';

describe('listingPath', () => {
  test('venues live under /venues', () => expect(listingPath({ slug: 'touch-of-cozy-patna', category: 'venue' })).toBe('/venues/touch-of-cozy-patna'));
  test('every other category keeps /vendors', () => {
    expect(listingPath({ slug: 'the-instastudio', category: 'photo-video' })).toBe('/vendors/the-instastudio');
    expect(listingPath({ slug: 'x', category: undefined })).toBe('/vendors/x');
  });
  test('falls back to the id when there is no slug', () => expect(listingPath({ id: 'abc', category: 'venue' })).toBe('/venues/abc'));
});
