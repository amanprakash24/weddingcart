/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { paymentRequestMessage, validateVenuePayment } from './payment';

const TODAY = '2026-10-05';

describe('validateVenuePayment', () => {
  test('an amount and how it was paid are enough', () => {
    expect(validateVenuePayment({ amount: '20000', method: 'CASH' }, TODAY)).toEqual({ ok: true, value: { amount: 20000, method: 'CASH', reference: null, paidOn: null } });
  });

  test('the amount is read however it was typed; the reference is trimmed', () => {
    expect(validateVenuePayment({ amount: '₹ 1,20,000', method: 'UPI', reference: '  UTR123  ' }, TODAY)).toMatchObject({ ok: true, value: { amount: 120000, reference: 'UTR123' } });
    expect(validateVenuePayment({ amount: 500, method: 'CHEQUE' }, TODAY)).toMatchObject({ ok: true, value: { amount: 500 } });
  });

  test('a wrong amount or method is explained under its own box', () => {
    for (const bad of ['', '0', '-500', '12.50', 'ten thousand', '99999999999']) expect(validateVenuePayment({ amount: bad, method: 'CASH' }, TODAY)).toMatchObject({ ok: false, errors: { amount: expect.any(String) } });
    for (const bad of [undefined, '', 'CARD', 'RAZORPAY', 'cash']) expect(validateVenuePayment({ amount: '100', method: bad }, TODAY)).toMatchObject({ ok: false, errors: { method: expect.any(String) } });
    expect(validateVenuePayment({ amount: '100', method: 'CASH', reference: 'x'.repeat(121) }, TODAY)).toMatchObject({ ok: false, errors: { reference: expect.any(String) } });
  });

  test('received on: today (kept as "now") or an earlier day — never the future', () => {
    expect(validateVenuePayment({ amount: '100', method: 'CASH', paidOn: TODAY }, TODAY)).toMatchObject({ ok: true, value: { paidOn: null } });
    expect(validateVenuePayment({ amount: '100', method: 'CASH', paidOn: '2026-10-01' }, TODAY)).toMatchObject({ ok: true, value: { paidOn: '2026-10-01' } });
    for (const bad of ['2026-10-06', 'yesterday', '01/10/2026', '2026-13-40']) expect(validateVenuePayment({ amount: '100', method: 'CASH', paidOn: bad }, TODAY)).toMatchObject({ ok: false, errors: { paidOn: expect.any(String) } });
  });

  test('nothing else is taken from the request', () => {
    const r = validateVenuePayment({ amount: '100', method: 'CASH', status: 'SUCCESS', invoiceId: 'x', businessId: 'y', recordedById: 'z' }, TODAY);
    expect(r.ok && Object.keys(r.value).sort()).toEqual(['amount', 'method', 'paidOn', 'reference']);
  });
});

describe('paymentRequestMessage', () => {
  const base = { customerName: 'Rahul Kumar', venueName: 'Swayamvar Hall', number: 'SWA-QTN-202610-0001', amount: 60000, confirmsBooking: true, upiId: null, upiName: null };

  test('before the booking is confirmed: the amount that confirms it', () => {
    const text = paymentRequestMessage(base);
    expect(text).toContain('Namaste Rahul,');
    expect(text).toContain('₹60,000 confirms your booking');
    expect(text).not.toContain('UPI');
    expect(text).not.toContain('Shaadi Shopping');
  });

  test('the venue’s UPI details are included only when it set them', () => {
    expect(paymentRequestMessage({ ...base, upiId: 'swayamvar@okhdfcbank', upiName: 'Swayamvar Hall' })).toContain('pay by UPI to swayamvar@okhdfcbank (Swayamvar Hall).');
    expect(paymentRequestMessage({ ...base, upiId: 'swayamvar@okhdfcbank' })).toContain('pay by UPI to swayamvar@okhdfcbank.');
  });

  test('after confirmation it asks for the balance', () => {
    expect(paymentRequestMessage({ ...base, confirmsBooking: false, amount: 140000 })).toContain('The balance for your booking with Swayamvar Hall (SWA-QTN-202610-0001) is ₹1,40,000.');
  });
});
