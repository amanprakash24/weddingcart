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
});
