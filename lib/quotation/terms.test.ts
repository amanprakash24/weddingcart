/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { isVenueCategory, pickVenueTerms } from './terms';

const hall = { id: 'v1', defaultTerms: '  50% refundable up to 30 days before.  ', categoryName: 'Banquet Halls' };
const otherHall = { id: 'v2', defaultTerms: 'Second hall terms', categoryName: 'Venues' };
const photographer = { id: 'p1', defaultTerms: 'Photographer terms', categoryName: 'Photography' };

describe('pickVenueTerms', () => {
  test('takes the venue line\'s default terms, trimmed', () => {
    expect(pickVenueTerms([{ vendorId: 'v1' }], [hall])).toBe('50% refundable up to 30 days before.');
  });
  test('the first venue line wins, in the order the quotation lists them', () => {
    expect(pickVenueTerms([{ vendorId: 'v2' }, { vendorId: 'v1' }], [hall, otherHall])).toBe('Second hall terms');
  });
  test('a non-venue vendor\'s terms are never used', () => {
    expect(pickVenueTerms([{ vendorId: 'p1' }], [photographer])).toBeNull();
    expect(pickVenueTerms([{ vendorId: 'p1' }, { vendorId: 'v1' }], [photographer, hall])).toBe('50% refundable up to 30 days before.');
  });
  test('null when the venue has no default terms, when it is blank, or when no line has a vendor', () => {
    expect(pickVenueTerms([{ vendorId: 'v1' }], [{ ...hall, defaultTerms: null }])).toBeNull();
    expect(pickVenueTerms([{ vendorId: 'v1' }], [{ ...hall, defaultTerms: '   ' }])).toBeNull();
    expect(pickVenueTerms([{ vendorId: null }, {}], [hall])).toBeNull();
    expect(pickVenueTerms([], [hall])).toBeNull();
  });
});

describe('isVenueCategory', () => {
  test('recognises venue-type categories by name', () => {
    for (const n of ['Venues', 'Banquet Halls', 'Marriage Hall', 'Lawns', 'Resorts', 'Farmhouse']) expect(isVenueCategory(n)).toBe(true);
    for (const n of ['Photography', 'Catering', 'Decoration', 'DJ']) expect(isVenueCategory(n)).toBe(false);
  });
});
