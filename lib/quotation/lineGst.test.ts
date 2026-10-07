/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { gstPercentText, gstTotals, parseGstPercent } from './lineGst';

describe('parseGstPercent — what the vendor types in the GST % box', () => {
  test('blank means no GST on this line; there is no default rate', () => {
    for (const blank of ['', '   ', null, undefined]) expect(parseGstPercent(blank)).toBeNull();
  });

  test('whole and fractional rates, with or without a % sign', () => {
    expect(parseGstPercent('18')).toBe(1800);
    expect(parseGstPercent('5')).toBe(500);
    expect(parseGstPercent('12 %')).toBe(1200);
    expect(parseGstPercent('0.25')).toBe(25);
    expect(parseGstPercent('2.5')).toBe(250);
    expect(parseGstPercent(28)).toBe(2800);
    expect(parseGstPercent('0')).toBe(0);
  });

  test('anything that is not a sensible rate is refused, not guessed', () => {
    for (const bad of ['abc', '-5', '18.123', '180', '41', '1e2', '18,5', '5 percent']) expect(parseGstPercent(bad)).toBeUndefined();
    expect(parseGstPercent('40')).toBe(4000);
  });

  test('gstPercentText reads a stored rate back the way it was typed', () => {
    expect(gstPercentText(1800)).toBe('18');
    expect(gstPercentText(250)).toBe('2.5');
    expect(gstPercentText(25)).toBe('0.25');
  });
});

describe('gstTotals — GST line by line', () => {
  test('the founder’s example: decoration ₹1,00,000 at 18% → GST ₹18,000, total ₹1,18,000', () => {
    const t = gstTotals([{ quantity: 1, unitPrice: 100000, gstRateBp: 1800 }]);
    expect(t.lines[0]).toEqual({ amount: 100000, discount: 0, taxable: 100000, gstRateBp: 1800, gst: 18000 });
    expect(t).toMatchObject({ subtotal: 100000, discount: 0, taxable: 100000, gst: 18000, total: 118000, hasGst: true });
  });

  test('each line has its own rate; a line with no rate carries no GST', () => {
    const t = gstTotals([
      { quantity: 1, unitPrice: 100000, gstRateBp: 1800 }, // decoration
      { quantity: 200, unitPrice: 850, gstRateBp: 500 }, // catering, per plate
      { quantity: 1, unitPrice: 50000, gstRateBp: null }, // rental, no GST typed
    ]);
    expect(t.lines.map((l) => l.gst)).toEqual([18000, 8500, 0]);
    expect(t).toMatchObject({ subtotal: 320000, gst: 26500, total: 346500, hasGst: true });
  });

  test('no rates at all: the total is simply the lines minus the discount', () => {
    const t = gstTotals([{ quantity: 2, unitPrice: 1000 }, { quantity: 1, unitPrice: 500 }], 300);
    expect(t).toMatchObject({ subtotal: 2500, discount: 300, taxable: 2200, gst: 0, total: 2200, hasGst: false });
  });

  test('a discount comes off before GST, spread over the lines in proportion', () => {
    // ₹10,000 off ₹1,00,000 + ₹1,00,000: each line gives up ₹5,000, so GST is on ₹95,000 each.
    const t = gstTotals([{ quantity: 1, unitPrice: 100000, gstRateBp: 1800 }, { quantity: 1, unitPrice: 100000, gstRateBp: 500 }], 10000);
    expect(t.lines.map((l) => [l.discount, l.taxable, l.gst])).toEqual([[5000, 95000, 17100], [5000, 95000, 4750]]);
    expect(t).toMatchObject({ subtotal: 200000, discount: 10000, taxable: 190000, gst: 21850, total: 211850 });
  });

  test('the shares of a discount always add up to exactly the discount', () => {
    const t = gstTotals([{ quantity: 1, unitPrice: 100 }, { quantity: 1, unitPrice: 100 }, { quantity: 1, unitPrice: 100 }], 100);
    expect(t.lines.map((l) => l.discount)).toEqual([34, 33, 33]);
    expect(t.lines.reduce((a, l) => a + l.discount, 0)).toBe(100);
    expect(t.lines.reduce((a, l) => a + l.taxable, 0)).toBe(t.taxable);

    const odd = gstTotals([{ quantity: 3, unitPrice: 333 }, { quantity: 7, unitPrice: 1111 }, { quantity: 1, unitPrice: 5 }], 777);
    expect(odd.lines.reduce((a, l) => a + l.discount, 0)).toBe(777);
    expect(odd.lines.every((l) => l.taxable >= 0)).toBe(true);
  });

  test('GST is rounded to the nearest rupee on each line, and the total is the sum of what is shown', () => {
    const t = gstTotals([{ quantity: 1, unitPrice: 999, gstRateBp: 1800 }, { quantity: 1, unitPrice: 333, gstRateBp: 500 }]);
    expect(t.lines.map((l) => l.gst)).toEqual([180, 17]); // 179.82 → 180, 16.65 → 17
    expect(t.total).toBe(999 + 333 + 180 + 17);
  });

  test('a 0% rate is a rate — the line is marked as taxed at nil, and adds nothing', () => {
    const t = gstTotals([{ quantity: 1, unitPrice: 1000, gstRateBp: 0 }]);
    expect(t).toMatchObject({ gst: 0, total: 1000, hasGst: false });
  });

  test('a discount larger than the lines is capped at the lines', () => {
    expect(gstTotals([{ quantity: 1, unitPrice: 500, gstRateBp: 1800 }], 9000)).toMatchObject({ discount: 500, taxable: 0, gst: 0, total: 0 });
  });
});
