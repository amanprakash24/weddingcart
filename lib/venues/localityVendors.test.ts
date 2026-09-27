/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { toLocalityVenue, toLocalityVenues, type LocalityVendorRow } from './localityVendors';

function row(overrides: Partial<LocalityVendorRow> = {}): LocalityVendorRow {
  return {
    name: 'Dream Banquet Hall',
    slug: 'dream-banquet-hall-patna',
    rating: 4.5,
    guestCapacity: 450,
    venueType: 'Banquet Hall',
    priceMin: 700,
    priceMax: 850,
    features: ['In-house catering', 'Power backup'],
    image: 'https://example.com/dream.jpg',
    ...overrides,
  };
}

describe('toLocalityVenue', () => {
  test('maps real fields through without fabrication', () => {
    const v = toLocalityVenue(row(), 'Danapur');
    expect(v.name).toBe('Dream Banquet Hall');
    expect(v.area).toBe('Danapur');
    expect(v.rating).toBe(4.5);
    expect(v.vegPrice).toBe(700);
    expect(v.nonVegPrice).toBe(850);
    expect(v.href).toBe('/vendors/dream-banquet-hall-patna');
    expect(v.highlights).toEqual(['In-house catering', 'Power backup']);
  });

  test('capacityLabel says "Capacity on request" when guestCapacity is unknown, never a made-up number', () => {
    const v = toLocalityVenue(row({ guestCapacity: null }), 'Danapur');
    expect(v.capacityLabel).toBe('Capacity on request');
    expect(v.capacityMax).toBe(Number.MAX_SAFE_INTEGER);
  });

  test('capacityLabel uses the real guestCapacity when known', () => {
    const v = toLocalityVenue(row({ guestCapacity: 500 }), 'Danapur');
    expect(v.capacityLabel).toBe('Up to 500 guests');
    expect(v.capacityMax).toBe(500);
  });

  test('tagline falls back to a generic label when venueType is unset, never invents a specific type', () => {
    const v = toLocalityVenue(row({ venueType: null }), 'Danapur');
    expect(v.tagline).toBe('Verified Wedding Venue');
  });

  test('rooms is only set when a feature tag actually mentions stay/accommodation', () => {
    const withStay = toLocalityVenue(row({ features: ['In-house catering', 'Home stay available'] }), 'Danapur');
    expect(withStay.rooms).toBe('Home stay available');

    const withoutStay = toLocalityVenue(row({ features: ['In-house catering'] }), 'Danapur');
    expect(withoutStay.rooms).toBeUndefined();
  });

  test('toLocalityVenues maps a list and tags every row with the same area label', () => {
    const venues = toLocalityVenues([row({ name: 'A' }), row({ name: 'B' })], 'Saguna Mor');
    expect(venues.map((v) => v.name)).toEqual(['A', 'B']);
    expect(venues.every((v) => v.area === 'Saguna Mor')).toBe(true);
  });
});
