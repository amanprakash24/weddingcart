/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { withoutOwnerContact } from './publicVendor';

describe('withoutOwnerContact', () => {
  test('drops the owner name, phone and email and keeps everything else', () => {
    const out = withoutOwnerContact({ id: 'v1', slug: 'a-venue', name: 'A Venue', ownerName: 'X', ownerPhone: '+919800000000', ownerEmail: 'x@y.z', priceMin: 1 });
    expect(out).toEqual({ id: 'v1', slug: 'a-venue', name: 'A Venue', priceMin: 1 });
  });
  test('does not change the original object', () => {
    const v = { name: 'A', ownerPhone: '1' };
    withoutOwnerContact(v);
    expect(v.ownerPhone).toBe('1');
  });
});

describe('withoutOwnerContact — own contact lines in features', () => {
  test('website / instagram / phone lines are dropped, the rest kept', () => {
    const out = withoutOwnerContact({ name: 'A', features: ['10+ years of experience', 'Website: https://amitdecoration.com/', 'Instagram: @the_instastudio', 'Drone coverage'] });
    expect(out.features).toEqual(['10+ years of experience', 'Drone coverage']);
  });
});
