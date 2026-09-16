/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { bookingCreateSchema } from './schema';

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Priya Sharma',
    phone: '9876543210',
    city: 'Patna',
    total: 5000,
    items: [
      {
        vendorId: 'some-vendor',
        vendorName: 'Some Vendor',
        vendorCategory: 'Venues',
        packageName: 'Basic Package',
        price: 5000,
        quantity: 1,
      },
    ],
    ...overrides,
  };
}

describe('bookingCreateSchema', () => {
  test('accepts a well-formed booking', () => {
    expect(() => bookingCreateSchema.parse(validBody())).not.toThrow();
  });

  test('rejects quantity of 0', () => {
    const body = validBody({ items: [{ ...validBody().items[0], quantity: 0 }] });
    expect(() => bookingCreateSchema.parse(body)).toThrow();
  });

  test('rejects negative quantity', () => {
    const body = validBody({ items: [{ ...validBody().items[0], quantity: -5 }] });
    expect(() => bookingCreateSchema.parse(body)).toThrow();
  });

  test('rejects quantity above the ceiling', () => {
    const body = validBody({ items: [{ ...validBody().items[0], quantity: 51 }] });
    expect(() => bookingCreateSchema.parse(body)).toThrow();
  });

  test('accepts quantity at the ceiling', () => {
    const body = validBody({ items: [{ ...validBody().items[0], quantity: 50 }] });
    expect(() => bookingCreateSchema.parse(body)).not.toThrow();
  });

  test('rejects a non-integer quantity', () => {
    const body = validBody({ items: [{ ...validBody().items[0], quantity: 1.5 }] });
    expect(() => bookingCreateSchema.parse(body)).toThrow();
  });

  test('rejects an empty items array', () => {
    expect(() => bookingCreateSchema.parse(validBody({ items: [] }))).toThrow();
  });

  test('rejects more than 50 items', () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ ...validBody().items[0], vendorId: `vendor-${i}` }));
    expect(() => bookingCreateSchema.parse(validBody({ items }))).toThrow();
  });

  test('accepts exactly 50 items', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ ...validBody().items[0], vendorId: `vendor-${i}` }));
    expect(() => bookingCreateSchema.parse(validBody({ items }))).not.toThrow();
  });

  test('rejects a name over 200 characters', () => {
    expect(() => bookingCreateSchema.parse(validBody({ name: 'a'.repeat(201) }))).toThrow();
  });

  test('rejects an empty name', () => {
    expect(() => bookingCreateSchema.parse(validBody({ name: '' }))).toThrow();
  });

  test('rejects a phone over 200 characters', () => {
    expect(() => bookingCreateSchema.parse(validBody({ phone: '1'.repeat(201) }))).toThrow();
  });

  test('rejects a city over 200 characters', () => {
    expect(() => bookingCreateSchema.parse(validBody({ city: 'a'.repeat(201) }))).toThrow();
  });

  describe('weddingDate / weddingType / guestCount — optional, additive (production-integrity fix)', () => {
    test('accepts a booking with none of the three fields, leaving them undefined — preserves existing /cart behavior', () => {
      const parsed = bookingCreateSchema.parse(validBody());
      expect(parsed.weddingDate).toBeUndefined();
      expect(parsed.weddingType).toBeUndefined();
      expect(parsed.guestCount).toBeUndefined();
    });

    test('accepts and coerces a valid weddingDate string into a Date instance', () => {
      const parsed = bookingCreateSchema.parse(validBody({ weddingDate: '2027-02-14' }));
      expect(parsed.weddingDate).toBeInstanceOf(Date);
      expect(parsed.weddingDate?.getUTCFullYear()).toBe(2027);
    });

    test('rejects an invalid weddingDate', () => {
      expect(() => bookingCreateSchema.parse(validBody({ weddingDate: 'not-a-date' }))).toThrow();
    });

    // Real Enquiry.eventDate data includes free-text-shaped, typo'd values
    // like this one — JS's Date constructor parses it into a *valid* Date
    // 18000 years in the future rather than failing, so bare
    // z.coerce.date() would have silently accepted it. weddingDate's strict
    // YYYY-MM-DD regex rejects it outright.
    test('rejects a malformed free-text date ("20 October 20202") that JS Date would otherwise silently accept', () => {
      const asDate = new Date('20 October 20202');
      expect(isNaN(asDate.getTime())).toBe(false); // confirms this is the exact silent-accept trap, not a no-op case
      expect(() => bookingCreateSchema.parse(validBody({ weddingDate: '20 October 20202' }))).toThrow();
    });

    test('rejects a YYYY-MM-DD-shaped but semantically invalid date (month 13)', () => {
      expect(() => bookingCreateSchema.parse(validBody({ weddingDate: '2027-13-45' }))).toThrow();
    });

    test('accepts a weddingType string', () => {
      const parsed = bookingCreateSchema.parse(validBody({ weddingType: 'Traditional Hindu' }));
      expect(parsed.weddingType).toBe('Traditional Hindu');
    });

    test('accepts and coerces a numeric-string guestCount (matching Enquiry.guestCount, which is a string)', () => {
      const parsed = bookingCreateSchema.parse(validBody({ guestCount: '250' }));
      expect(parsed.guestCount).toBe(250);
    });

    test('rejects a zero guestCount', () => {
      expect(() => bookingCreateSchema.parse(validBody({ guestCount: 0 }))).toThrow();
    });

    test('rejects a negative guestCount', () => {
      expect(() => bookingCreateSchema.parse(validBody({ guestCount: -10 }))).toThrow();
    });

    test('rejects a non-integer guestCount', () => {
      expect(() => bookingCreateSchema.parse(validBody({ guestCount: 12.5 }))).toThrow();
    });
  });

  describe('enquiryId / consultationId — optional links for the duplicate-Wedding guard (production-integrity fix)', () => {
    test('leaves both undefined when omitted — preserves existing /cart behavior', () => {
      const parsed = bookingCreateSchema.parse(validBody());
      expect(parsed.enquiryId).toBeUndefined();
      expect(parsed.consultationId).toBeUndefined();
    });

    test('accepts an enquiryId when provided', () => {
      const parsed = bookingCreateSchema.parse(validBody({ enquiryId: 'enquiry-1' }));
      expect(parsed.enquiryId).toBe('enquiry-1');
    });

    test('accepts a consultationId when provided', () => {
      const parsed = bookingCreateSchema.parse(validBody({ consultationId: 'consultation-1' }));
      expect(parsed.consultationId).toBe('consultation-1');
    });

    test('rejects an empty-string enquiryId', () => {
      expect(() => bookingCreateSchema.parse(validBody({ enquiryId: '' }))).toThrow();
    });
  });
});
