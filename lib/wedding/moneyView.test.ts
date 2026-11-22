/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import type { WeddingWorkspace } from '@/services/weddingWorkspace.service';
import { MASKED_AMOUNT, maskAmounts, maskCommission, weddingMoneyView } from './moneyView';

// A minimal Control Room payload with every kind of money in it: a vendor price, a payout with commission, a couple's invoice,
// the agreement, and timeline entries that write amounts into their text.
function workspace(): WeddingWorkspace {
  return {
    events: [
      {
        id: 'e1', budget: 500000,
        vendorBookings: [
          {
            id: 'vb1', vendorName: 'Decor Co', agreedPrice: 120000,
            payout: { id: 'p1', grossAmount: 120000, commissionRate: 10, commissionAmount: 12000, netAmount: 108000, status: 'PENDING', paidAt: null },
          },
        ],
      },
    ],
    finance: {
      budget: { planned: 900000, committed: 120000, variance: 780000 },
      invoices: [{ id: 'inv1', total: 200000, amountPaid: 50000, outstanding: 150000 }],
      totals: { invoicedTotal: 200000, collected: 50000, outstanding: 150000 },
      agreement: { quotationId: 'q1', total: 800000 },
    },
    activity: [
      { id: 'a1', summary: 'Payment received: ₹50,000 via upi', detail: null },
      { id: 'a2', summary: 'Payout calculated: ₹1,08,000 net (₹12,000 commission @ 10%)', detail: 'Booked at ₹1,20,000' },
      { id: 'a3', summary: 'Vendor confirmed for Sangeet', detail: null },
    ],
  } as unknown as WeddingWorkspace;
}

describe('maskAmounts / maskCommission', () => {
  test('every rupee amount is masked, words are kept', () => {
    expect(maskAmounts('Payment received: ₹50,000 via upi')).toBe(`Payment received: ${MASKED_AMOUNT} via upi`);
    expect(maskAmounts('₹2.5 L budget, ₹ 40,000.50 paid')).toBe(`${MASKED_AMOUNT} budget, ${MASKED_AMOUNT} paid`);
    expect(maskAmounts(null)).toBeNull();
    expect(maskAmounts('No money here')).toBe('No money here');
  });
  test('only the commission phrase is removed', () => {
    expect(maskCommission('Payout calculated: ₹1,08,000 net (₹12,000 commission @ 10%)')).toBe('Payout calculated: ₹1,08,000 net');
    expect(maskCommission(null)).toBeNull();
  });
});

describe('weddingMoneyView', () => {
  test('founder (full + commission): unchanged, flags all true', () => {
    const ws = workspace();
    const view = weddingMoneyView(ws, 'full', true);
    expect(view.money).toEqual({ access: 'full', vendorMoney: true, commission: true, assign: true });
    expect(view.events).toEqual(ws.events);
    expect(view.finance).toEqual(ws.finance);
    expect(view.activity).toEqual(ws.activity);
  });

  test('coordinator (full, no commission): vendor prices and payouts kept, commission zeroed and cut from the timeline', () => {
    const view = weddingMoneyView(workspace(), 'full', false);
    expect(view.money).toEqual({ access: 'full', vendorMoney: true, commission: false, assign: false });
    const vb = view.events[0].vendorBookings[0];
    expect(vb.agreedPrice).toBe(120000);
    expect(vb.payout).toMatchObject({ netAmount: 108000, commissionRate: 0, commissionAmount: 0 });
    expect(view.finance.totals.outstanding).toBe(150000);
    expect(view.activity[1].summary).toBe('Payout calculated: ₹1,08,000 net');
    expect(view.activity[0].summary).toBe('Payment received: ₹50,000 via upi');
  });

  test('lead owner after booking (read): couple money kept; vendor prices, payouts and committed spend withheld; amounts in the timeline masked', () => {
    const view = weddingMoneyView(workspace(), 'read', false);
    expect(view.money).toMatchObject({ access: 'read', vendorMoney: false, commission: false });
    const vb = view.events[0].vendorBookings[0];
    expect(vb.agreedPrice).toBe(0);
    expect(vb.payout).toBeNull();
    expect(view.finance.invoices).toHaveLength(1);
    expect(view.finance.totals.collected).toBe(50000);
    expect(view.finance.agreement).not.toBeNull();
    expect(view.finance.budget).toEqual({ planned: 900000, committed: 0, variance: null });
    expect(view.activity.every((a) => !/₹\d/.test(a.summary) && !/₹\d/.test(a.detail ?? ''))).toBe(true);
  });

  test('anyone else (none): no invoices, totals, agreement, vendor prices or payouts; amounts masked; non-money kept', () => {
    const view = weddingMoneyView(workspace(), 'none', false);
    expect(view.money).toMatchObject({ access: 'none', vendorMoney: false, commission: false, assign: false });
    expect(view.finance.invoices).toEqual([]);
    expect(view.finance.totals).toEqual({ invoicedTotal: 0, collected: 0, outstanding: 0 });
    expect(view.finance.agreement).toBeNull();
    expect(view.events[0].vendorBookings[0]).toMatchObject({ vendorName: 'Decor Co', agreedPrice: 0, payout: null });
    expect(view.activity[0].summary).toBe(`Payment received: ${MASKED_AMOUNT} via upi`);
    expect(view.activity[2].summary).toBe('Vendor confirmed for Sangeet');
  });

  test('does not change the payload it was given', () => {
    const ws = workspace();
    const before = JSON.stringify(ws);
    weddingMoneyView(ws, 'none', false);
    expect(JSON.stringify(ws)).toBe(before);
  });
});
