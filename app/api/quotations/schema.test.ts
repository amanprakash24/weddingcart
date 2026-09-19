/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { createQuotationSchema, updateQuotationSchema } from './schema';

const item = { description: 'Grand Ballroom — 500 guests', unitPrice: 400000, quantity: 1 };
const valid = { sourceType: 'ENQUIRY', sourceId: 'e1', items: [item] };

describe('createQuotationSchema', () => {
  test('accepts a minimal quotation and applies safe defaults (no tax, no discount, no advance)', () => {
    const parsed = createQuotationSchema.parse(valid);
    expect(parsed).toMatchObject({ discount: 0, gstEnabled: false, gstAmount: 0, advanceAmount: 0, validUntil: null });
  });

  test('coerces numeric strings from a form', () => {
    const parsed = createQuotationSchema.parse({
      ...valid,
      items: [{ ...item, unitPrice: '800', quantity: '500' }],
      advanceAmount: '200000',
    });
    expect(parsed.items[0]).toMatchObject({ unitPrice: 800, quantity: 500 });
    expect(parsed.advanceAmount).toBe(200000);
  });

  test('never carries a client-sent total — unknown money fields are stripped', () => {
    const parsed = createQuotationSchema.parse({ ...valid, subtotal: 1, total: 1, balance: 1 }) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty('subtotal');
    expect(parsed).not.toHaveProperty('total');
    expect(parsed).not.toHaveProperty('balance');
  });

  test.each([
    ['no items', { items: [] }],
    ['a blank description', { items: [{ ...item, description: '   ' }] }],
    ['a fractional price', { items: [{ ...item, unitPrice: 10.5 }] }],
    ['quantity 0', { items: [{ ...item, quantity: 0 }] }],
    ['a negative discount', { discount: -1 }],
    ['an unknown sourceType', { sourceType: 'BOOKING' }],
    ['an empty sourceId', { sourceId: '' }],
    ['more than 50 lines', { items: Array.from({ length: 51 }, () => item) }],
  ])('rejects %s', (_name, patch) => {
    expect(createQuotationSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  test('a tax amount without turning tax on is rejected on the gstAmount field', () => {
    const result = createQuotationSchema.safeParse({ ...valid, gstAmount: 100 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(['gstAmount']);
    expect(createQuotationSchema.safeParse({ ...valid, gstEnabled: true, gstAmount: 100 }).success).toBe(true);
  });

  test('validUntil: a date means the end of that day in IST; blank is none; garbage is rejected', () => {
    const parsed = createQuotationSchema.parse({ ...valid, validUntil: '2026-10-01' });
    expect(parsed.validUntil?.toISOString()).toBe('2026-10-01T18:29:59.000Z');
    expect(createQuotationSchema.parse({ ...valid, validUntil: '' }).validUntil).toBeNull();
    expect(createQuotationSchema.parse({ ...valid, validUntil: null }).validUntil).toBeNull();
    expect(createQuotationSchema.safeParse({ ...valid, validUntil: 'next friday' }).success).toBe(false);
  });
});

describe('updateQuotationSchema', () => {
  test('has no source fields — a quotation cannot be moved to another lead/enquiry', () => {
    const parsed = updateQuotationSchema.parse({ ...valid }) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty('sourceType');
    expect(parsed).not.toHaveProperty('sourceId');
  });

  test('applies the same tax rule', () => {
    expect(updateQuotationSchema.safeParse({ items: [item], gstAmount: 5 }).success).toBe(false);
  });
});
