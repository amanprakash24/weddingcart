import { describe, expect, test } from 'bun:test';
import { buildWorkOrder, checkPricing, vendorWorkOrderView, WORK_ORDER_TERMS } from './workOrder';
import type { AssignmentFacts } from './vendorMoney';

const facts = (over: Partial<AssignmentFacts> = {}): AssignmentFacts => ({ id: 'vb', status: 'CONFIRMED', venueStatus: 'PENDING', agreedPrice: 100000, currentRate: 10, payout: null, payments: [], ...over });
const scope = { weddingNumber: 'WED-2026-0009', coupleName: 'Asha & Ravi', functionName: 'Haldi', functionDate: '2026-11-27', startTime: '10:00', venueName: 'Garden', venueAddress: null, city: 'Patna', guestCount: 200, service: 'Decorators', packageName: null, deliverables: 'Marigold stage, entry arch' };

describe('issuing a work order', () => {
  test('commission model: frozen at today’s rate — the worked example (₹1,00,000 at 10%)', () => {
    expect(buildWorkOrder(facts(), scope)).toEqual({
      ok: true,
      value: { pricingModel: 'COMMISSION', vendorPayable: 90000, clientPrice: 100000, commissionRate: 10, commissionAmount: 10000, margin: 10000, scope: { ...scope, terms: WORK_ORDER_TERMS } },
    });
  });
  test('fixed model: the vendor price, no commission (the worked example, vendor ₹80,000)', () => {
    expect(buildWorkOrder(facts({ pricingModel: 'FIXED', vendorPrice: 80000 }), scope)).toMatchObject({ ok: true, value: { pricingModel: 'FIXED', vendorPayable: 80000, commissionRate: null, commissionAmount: null, margin: 20000 } });
  });
  test('not issued when the amount is unknown — never guessed', () => {
    expect(buildWorkOrder(facts({ currentRate: null }), scope)).toMatchObject({ ok: false, reason: expect.stringContaining('commission rate') });
    expect(buildWorkOrder(facts({ pricingModel: 'FIXED', vendorPrice: null }), scope)).toMatchObject({ ok: false, reason: expect.stringContaining('fixed vendor price') });
  });
});

describe('what a vendor is sent', () => {
  test('scope and their own amount only — no client price, commission or margin', () => {
    const v = vendorWorkOrderView({ id: 'w', number: 'WO-202611-0001', status: 'ISSUED', issuedAt: new Date('2026-11-25T10:00:00Z'), cancelledAt: null, cancelReason: null, vendorPayable: 90000, scope: { ...scope, terms: WORK_ORDER_TERMS } });
    expect(Object.keys(v).sort()).toEqual(['cancelReason', 'cancelledAt', 'id', 'issuedAt', 'number', 'scope', 'status', 'vendorPayable']);
    const sent = JSON.stringify(v);
    for (const secret of ['100000', 'clientPrice', 'commission', 'margin', '10000,']) expect(sent).not.toContain(secret);
    expect(v.vendorPayable).toBe(90000);
  });
});

describe('setting the pricing model (founder)', () => {
  test('commission, or a fixed price in whole rupees', () => {
    expect(checkPricing({ model: 'COMMISSION' }, 100000)).toEqual({ ok: true, value: { pricingModel: 'COMMISSION', vendorPrice: null, note: null } });
    expect(checkPricing({ model: 'FIXED', vendorPrice: '80,000' }, 100000)).toEqual({ ok: true, value: { pricingModel: 'FIXED', vendorPrice: 80000, note: null } });
    expect(checkPricing({ model: 'FIXED', vendorPrice: '' }, 100000)).toMatchObject({ ok: false });
    expect(checkPricing({ model: 'FIXED', vendorPrice: 10.5 }, 100000)).toMatchObject({ ok: false });
    expect(checkPricing({ model: 'BOTH' }, 100000)).toMatchObject({ ok: false });
  });
  test('a vendor price above the couple’s price needs an explicit confirmation and a reason', () => {
    expect(checkPricing({ model: 'FIXED', vendorPrice: 110000 }, 100000)).toMatchObject({ ok: false, error: expect.stringContaining('₹10,000 above') });
    expect(checkPricing({ model: 'FIXED', vendorPrice: 110000, acceptNegativeMargin: true, reason: ' ' }, 100000)).toMatchObject({ ok: false });
    expect(checkPricing({ model: 'FIXED', vendorPrice: 110000, acceptNegativeMargin: true, reason: 'Only decorator free on the date' }, 100000)).toEqual({ ok: true, value: { pricingModel: 'FIXED', vendorPrice: 110000, note: 'negative margin accepted: Only decorator free on the date' } });
  });
});

describe('historical work orders (PR 5)', () => {
  test('a work already settled by an older payout keeps the payout’s own figures, not today’s rate', () => {
    const settled = facts({ status: 'COMPLETED', agreedPrice: 75000, currentRate: 12, payout: { status: 'PAID', commissionRate: 10, commissionAmount: 7500, netAmount: 67500 } });
    expect(buildWorkOrder(settled, scope)).toMatchObject({ ok: true, value: { pricingModel: 'COMMISSION', vendorPayable: 67500, clientPrice: 75000, commissionRate: 10, commissionAmount: 7500, margin: 7500 } });
  });
  test('an older payout that no longer matches the agreed price is not issued — settled by hand first', () => {
    const drifted = facts({ status: 'COMPLETED', agreedPrice: 80000, payout: { status: 'PAID', commissionRate: 10, commissionAmount: 7500, netAmount: 67500 } });
    expect(buildWorkOrder(drifted, scope)).toMatchObject({ ok: false, reason: expect.stringContaining('older payout') });
  });
});
