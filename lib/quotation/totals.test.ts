/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { ValidationError } from '@/lib/errors';
import { MAX_LINE_ITEMS, MAX_TOTAL_RUPEES, calculateQuotationTotals, lineTotal } from './totals';

const line = (unitPrice: number, quantity = 1) => ({ unitPrice, quantity });

describe('calculateQuotationTotals — the money rules (08-quotation.md §5)', () => {
  test('the handoff scenario: ₹5,00,000 with ₹2,00,000 advance leaves ₹3,00,000 balance', () => {
    const t = calculateQuotationTotals({ items: [line(500000)], advanceAmount: 200000 });
    expect(t).toEqual({ subtotal: 500000, discount: 0, gstAmount: 0, total: 500000, advanceAmount: 200000, balance: 300000 });
  });

  test('quantity multiplies: 500 plates × ₹800 is ₹4,00,000, not ₹800', () => {
    expect(lineTotal(line(800, 500))).toBe(400000);
    expect(calculateQuotationTotals({ items: [line(800, 500), line(100000)] }).subtotal).toBe(500000);
  });

  test('total = subtotal − discount + tax, and balance is total − advance', () => {
    const t = calculateQuotationTotals({ items: [line(1000)], discount: 100, gstAmount: 50, advanceAmount: 300 });
    expect(t.total).toBe(950);
    expect(t.balance).toBe(650);
  });

  test('all optional amounts default to zero', () => {
    const t = calculateQuotationTotals({ items: [line(10)] });
    expect([t.discount, t.gstAmount, t.advanceAmount, t.balance]).toEqual([0, 0, 0, 10]);
  });

  test('a discount equal to the subtotal is allowed (a free quote), more than it is not', () => {
    expect(calculateQuotationTotals({ items: [line(100)], discount: 100 }).total).toBe(0);
    expect(() => calculateQuotationTotals({ items: [line(100)], discount: 101 })).toThrow(
      'Discount cannot be more than the subtotal'
    );
  });

  test('an advance equal to the total is allowed, more than it is not — tax counts towards the total', () => {
    expect(calculateQuotationTotals({ items: [line(100)], gstAmount: 18, advanceAmount: 118 }).balance).toBe(0);
    expect(() => calculateQuotationTotals({ items: [line(100)], gstAmount: 18, advanceAmount: 119 })).toThrow(
      'Advance cannot be more than the total'
    );
  });

  test.each([
    ['fractional price', { items: [line(10.5)] }],
    ['negative price', { items: [line(-1)] }],
    ['NaN price', { items: [line(NaN)] }],
    ['zero quantity', { items: [line(10, 0)] }],
    ['fractional quantity', { items: [line(10, 1.5)] }],
    ['negative discount', { items: [line(10)], discount: -1 }],
    ['fractional discount', { items: [line(10)], discount: 0.5 }],
    ['negative tax', { items: [line(10)], gstAmount: -1 }],
    ['negative advance', { items: [line(10)], advanceAmount: -1 }],
  ])('rejects %s with a ValidationError', (_name, input) => {
    expect(() => calculateQuotationTotals(input)).toThrow(ValidationError);
  });

  test('refuses values that would overflow the 32-bit money columns', () => {
    expect(() => calculateQuotationTotals({ items: [line(100_000_000, 100_000)] })).toThrow('too large');
    expect(() => calculateQuotationTotals({ items: [line(200_000_000)] })).toThrow('too large');
    expect(() => calculateQuotationTotals({ items: [line(1)], gstAmount: MAX_TOTAL_RUPEES + 1 })).toThrow('too large');
    // exactly at the ceiling is fine
    expect(calculateQuotationTotals({ items: [line(MAX_TOTAL_RUPEES / 100_000, 100_000)] }).total).toBe(MAX_TOTAL_RUPEES);
  });

  test('caps the number of lines', () => {
    const many = Array.from({ length: MAX_LINE_ITEMS + 1 }, () => line(1));
    expect(() => calculateQuotationTotals({ items: many })).toThrow(`at most ${MAX_LINE_ITEMS}`);
    expect(calculateQuotationTotals({ items: many.slice(0, MAX_LINE_ITEMS) }).subtotal).toBe(MAX_LINE_ITEMS);
  });

  test('error messages name the offending line', () => {
    expect(() => calculateQuotationTotals({ items: [line(10), line(-5)] })).toThrow('Line 2 price');
  });
});
