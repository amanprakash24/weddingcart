/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { buildAgreementSnapshot, planPaymentSplit, type AcceptedQuotationForSnapshot } from './agreement';

const quotation = (over: Partial<AcceptedQuotationForSnapshot> = {}): AcceptedQuotationForSnapshot => ({
  id: 'q1', revision: 3, subtotal: 210000, discount: 10000, gstAmount: 0, total: 200000, terms: 'Venue terms v1', acceptedAt: new Date('2026-09-20T10:00:00Z'), acceptedById: 'staff-1',
  items: [
    { id: 'i1', description: 'Banquet hall hire', category: 'Venue', functionLabel: ' Wedding ', vendorId: 'v1', unitPrice: 60000, quantity: 1 },
    { id: 'i2', description: 'Catering', category: 'Catering', functionLabel: 'Sangeet', vendorId: null, unitPrice: 500, quantity: 300 },
  ],
  ...over,
});
const customer = { name: 'Asha Rao', phone: '9000000000', customerId: null };

describe('buildAgreementSnapshot', () => {
  test('freezes the accepted total, the rule it was made under, and the exact confirmation amount', () => {
    const s = buildAgreementSnapshot({ quotation: quotation(), customer, bookingId: 'b1' });
    expect(s).toMatchObject({
      quotationId: 'q1', quotationRevision: 3, bookingId: 'b1', currency: 'INR',
      subtotal: 210000, discountAmount: 10000, taxAmount: 0, agreementTotal: 200000,
      confirmationPercent: 25, confirmationAmount: 50000, confirmationRounding: 'CEIL_RUPEE', holdWindowDays: 7,
      termsSnapshot: 'Venue terms v1', customerName: 'Asha Rao', customerPhone: '9000000000',
    });
  });
  test('keeps enough of each accepted line to rebuild the deal, using the quotation item ids', () => {
    const s = buildAgreementSnapshot({ quotation: quotation(), customer });
    expect(s.itemsSnapshot[0]).toEqual({ itemId: 'i1', name: 'Banquet hall hire', description: 'Banquet hall hire', category: 'Venue', vendorId: 'v1', quantity: 1, unitPrice: 60000, total: 60000, functionLabel: 'Wedding' });
    expect(s.itemsSnapshot[1]).toMatchObject({ itemId: 'i2', quantity: 300, unitPrice: 500, total: 150000, vendorId: null });
    expect(s.functionLabels).toEqual(['Wedding', 'Sangeet']);
  });
  test('a different rule set is recorded as it was, so a later change never re-prices this deal', () => {
    const s = buildAgreementSnapshot({ quotation: quotation(), customer, rules: { confirmationPercent: 30, holdWindowDays: 10, rounding: 'CEIL_RUPEE' } });
    expect(s).toMatchObject({ confirmationPercent: 30, confirmationAmount: 60000, holdWindowDays: 10 });
  });
  test('rounds the confirmation amount up', () => {
    expect(buildAgreementSnapshot({ quotation: quotation({ total: 100001 }), customer }).confirmationAmount).toBe(25001);
  });
  test('copies nothing that stays live: no payments, statuses, vendor confirmation or stage', () => {
    const keys = Object.keys(buildAgreementSnapshot({ quotation: quotation(), customer }));
    for (const live of ['amountReceived', 'received', 'status', 'paymentStatus', 'vendorStatus', 'stage', 'coordinator', 'balance']) expect(keys).not.toContain(live);
  });
});

describe('planPaymentSplit — ₹2,00,000 agreement, ₹50,000 to confirm', () => {
  const base = { agreementTotal: 200000, confirmationAmount: 50000, advancePaid: 0, balancePaid: 0 };

  test('a part payment goes to the advance invoice', () => {
    expect(planPaymentSplit({ ...base, amount: 20000 })).toEqual({ ok: true, splits: [{ target: 'ADVANCE', amount: 20000 }] });
  });
  test('the rest of the 25% completes the advance invoice', () => {
    expect(planPaymentSplit({ ...base, advancePaid: 20000, amount: 30000 })).toEqual({ ok: true, splits: [{ target: 'ADVANCE', amount: 30000 }] });
  });
  test('MORE than 25% is accepted: ₹70,000 = ₹50,000 on the advance + ₹20,000 on the balance, and the arithmetic stays true', () => {
    const r = planPaymentSplit({ ...base, amount: 70000 });
    expect(r).toEqual({ ok: true, splits: [{ target: 'ADVANCE', amount: 50000 }, { target: 'BALANCE', amount: 20000 }] });
    if (r.ok) expect(r.splits.reduce((s, x) => s + x.amount, 0)).toBe(70000);
  });
  test('once the advance is paid, further payments go to the balance', () => {
    expect(planPaymentSplit({ ...base, advancePaid: 50000, balancePaid: 20000, amount: 30000 })).toEqual({ ok: true, splits: [{ target: 'BALANCE', amount: 30000 }] });
  });
  test('paying the whole agreement at once works', () => {
    expect(planPaymentSplit({ ...base, amount: 200000 })).toEqual({ ok: true, splits: [{ target: 'ADVANCE', amount: 50000 }, { target: 'BALANCE', amount: 150000 }] });
  });
  test('never more than what is still owed on the agreement', () => {
    const r = planPaymentSplit({ ...base, advancePaid: 50000, balancePaid: 140000, amount: 20000 });
    expect(r).toEqual({ ok: false, error: 'The amount is more than the balance due (₹10,000)' });
    expect(planPaymentSplit({ ...base, amount: 200001 })).toMatchObject({ ok: false });
  });
  test('a fully paid agreement takes nothing more; bad amounts are refused', () => {
    expect(planPaymentSplit({ ...base, advancePaid: 50000, balancePaid: 150000, amount: 1 })).toEqual({ ok: false, error: 'This agreement is already fully paid' });
    expect(planPaymentSplit({ ...base, amount: 0 })).toMatchObject({ ok: false });
    expect(planPaymentSplit({ ...base, amount: 10.5 })).toMatchObject({ ok: false });
    expect(planPaymentSplit({ ...base, amount: -5 })).toMatchObject({ ok: false });
  });
  test('an overpaid advance (paid beyond its total by an old record) does not go negative', () => {
    expect(planPaymentSplit({ ...base, advancePaid: 60000, amount: 10000 })).toEqual({ ok: true, splits: [{ target: 'BALANCE', amount: 10000 }] });
  });
});
