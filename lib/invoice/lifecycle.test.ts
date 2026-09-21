/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { agreementFigures, balanceOf, checkBalanceInvoice, checkManualPayment, deriveInvoiceStatus, planBalanceInvoice } from './lifecycle';

describe('deriveInvoiceStatus', () => {
  const base = { total: 50_000 };
  test('an invoice nobody has issued or paid stays DRAFT', () => {
    expect(deriveInvoiceStatus({ ...base, current: 'DRAFT', paid: 0, issued: false })).toBe('DRAFT');
  });
  test('issuing (a payment link, or "issue") moves DRAFT to SENT', () => {
    expect(deriveInvoiceStatus({ ...base, current: 'DRAFT', paid: 0, issued: true })).toBe('SENT');
  });
  test('a part payment is PARTIALLY_PAID, even on an invoice that was never issued first', () => {
    expect(deriveInvoiceStatus({ ...base, current: 'SENT', paid: 20_000, issued: true })).toBe('PARTIALLY_PAID');
    expect(deriveInvoiceStatus({ ...base, current: 'DRAFT', paid: 20_000, issued: false })).toBe('PARTIALLY_PAID');
  });
  test('the full amount is PAID, and PAID never moves back', () => {
    expect(deriveInvoiceStatus({ ...base, current: 'PARTIALLY_PAID', paid: 50_000, issued: true })).toBe('PAID');
    expect(deriveInvoiceStatus({ ...base, current: 'SENT', paid: 60_000, issued: true })).toBe('PAID');
    expect(deriveInvoiceStatus({ ...base, current: 'PAID', paid: 0, issued: true })).toBe('PAID');
  });
  test('a SENT or PARTIALLY_PAID invoice keeps its state when nothing changed', () => {
    expect(deriveInvoiceStatus({ ...base, current: 'SENT', paid: 0, issued: true })).toBe('SENT');
    expect(deriveInvoiceStatus({ ...base, current: 'PARTIALLY_PAID', paid: 0, issued: true })).toBe('PARTIALLY_PAID');
  });
  test('a zero-total invoice is never "paid" by having nothing paid', () => {
    expect(deriveInvoiceStatus({ current: 'SENT', total: 0, paid: 0, issued: true })).toBe('SENT');
  });
});

describe('balance and manual payments', () => {
  test('balanceOf never goes negative', () => {
    expect(balanceOf(50_000, 20_000)).toBe(30_000);
    expect(balanceOf(50_000, 70_000)).toBe(0);
  });
  test('checkManualPayment accepts a valid part payment', () => {
    expect(checkManualPayment({ amount: 10_000, total: 50_000, paid: 0, method: 'CASH' })).toBeNull();
  });
  test('rejects an unknown method, a fractional or non-positive amount, an over-payment and a settled invoice', () => {
    expect(checkManualPayment({ amount: 100, total: 50_000, paid: 0, method: 'BITCOIN' })).toContain('how the payment was received');
    expect(checkManualPayment({ amount: 100.5, total: 50_000, paid: 0, method: 'UPI' })).toContain('whole rupees');
    expect(checkManualPayment({ amount: 0, total: 50_000, paid: 0, method: 'UPI' })).toContain('whole rupees');
    expect(checkManualPayment({ amount: 30_001, total: 50_000, paid: 20_000, method: 'UPI' })).toContain('more than the balance due (₹30,000)');
    expect(checkManualPayment({ amount: 1, total: 50_000, paid: 50_000, method: 'UPI' })).toContain('already fully paid');
  });
});

describe('the invoices of an accepted agreement', () => {
  const q = { quotationNumber: 'QTN-202609-0003', total: 110_000, advanceAmount: 50_000, status: 'ACCEPTED' };
  test('agreementFigures', () => {
    expect(agreementFigures(q)).toEqual({ total: 110_000, advance: 50_000, balance: 60_000 });
  });
  test('a balance invoice can be raised from the accepted quotation once', () => {
    expect(checkBalanceInvoice({ quotation: q, alreadyHasBalanceInvoice: false })).toBeNull();
    expect(checkBalanceInvoice({ quotation: q, alreadyHasBalanceInvoice: true })).toContain('already created');
  });
  test('no invoice from a quotation that is not the accepted one', () => {
    for (const status of ['DRAFT', 'SENT', 'SUPERSEDED', 'REJECTED', 'EXPIRED']) {
      expect(checkBalanceInvoice({ quotation: { ...q, status }, alreadyHasBalanceInvoice: false })).toContain('only the accepted quotation');
    }
    expect(checkBalanceInvoice({ quotation: null, alreadyHasBalanceInvoice: false })).toContain('no accepted quotation');
  });
  test('nothing to invoice when the advance covers the total', () => {
    expect(checkBalanceInvoice({ quotation: { ...q, advanceAmount: 110_000 }, alreadyHasBalanceInvoice: false })).toContain('nothing more to invoice');
  });
  test('planBalanceInvoice: balance = total − advance, one line, no tax, names the quotation', () => {
    const plan = planBalanceInvoice({ quotation: q, wedding: { primaryDate: new Date('2026-12-05T00:00:00Z'), weddingType: 'wedding' }, client: { name: 'Rahul', phone: '900', city: 'Patna' } });
    expect(plan.invoice).toMatchObject({ subtotal: 60_000, total: 60_000, discount: 0, gstEnabled: false, gstAmount: 0, eventDate: '2026-12-05', clientCity: 'Patna' });
    expect(plan.invoice.notes).toContain('QTN-202609-0003');
    expect(plan.items).toEqual([{ description: 'Balance — QTN-202609-0003', amount: 60_000, quantity: 1 }]);
  });
});
