/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { advanceInvoiceGst, balanceInvoiceGst } from './gstShare';

describe('GST on the invoices made from a quotation', () => {
  // ₹1,00,000 at 18% and ₹50,000 at 5% → GST ₹20,500, total ₹1,70,500. 25% confirms the booking: ₹42,625.
  const q = { total: 170_500, gstAmount: 20_500, sellerGstin: '10ABCDE1234F1Z5' };

  test('the first invoice carries its share of the GST; taxable value + GST = the invoice amount', () => {
    const a = advanceInvoiceGst(42_625, q);
    expect(a).toEqual({ taxable: 37_500, gst: 5_125, sellerGstin: '10ABCDE1234F1Z5' });
    expect(a.taxable + a.gst).toBe(42_625);
  });

  test('the balance invoice carries the rest — the two add up to the quotation exactly', () => {
    const a = advanceInvoiceGst(42_625, q);
    const b = balanceInvoiceGst(170_500 - 42_625, 42_625, q);
    expect(a.gst + b.gst).toBe(20_500);
    expect(a.taxable + b.taxable).toBe(150_000);
    expect(b.sellerGstin).toBe('10ABCDE1234F1Z5');
  });

  test('rounding never loses a rupee across the two invoices', () => {
    const odd = { total: 100_001, gstAmount: 15_255, sellerGstin: '10ABCDE1234F1Z5' };
    const a = advanceInvoiceGst(33_333, odd);
    const b = balanceInvoiceGst(100_001 - 33_333, 33_333, odd);
    expect(a.gst + b.gst).toBe(15_255);
    expect(a.taxable + a.gst + b.taxable + b.gst).toBe(100_001);
  });

  test('a quotation with no GST: the invoice is what it always was', () => {
    expect(advanceInvoiceGst(30_000, { total: 120_000, gstAmount: 0, sellerGstin: '10ABCDE1234F1Z5' })).toEqual({ taxable: 30_000, gst: 0, sellerGstin: null });
    expect(balanceInvoiceGst(90_000, 30_000, { total: 120_000 })).toEqual({ taxable: 90_000, gst: 0, sellerGstin: null });
  });

  test('GST with no frozen GST number (an older quotation, or Shaadi Shopping\'s own): no tax line is invented', () => {
    expect(advanceInvoiceGst(65_925, { total: 263_700, gstAmount: 23_700, sellerGstin: null })).toEqual({ taxable: 65_925, gst: 0, sellerGstin: null });
  });
});
