/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { planConfirmation, type ConfirmableQuotation } from './confirmation';
import { gstTotals } from '@/lib/quotation/lineGst';

const item = (id: string, unitPrice: number, gstRateBp: number | null = 1800, quantity = 1) => ({ id, description: `Service ${id}`, category: null, functionLabel: null, vendorId: null, unitPrice, quantity, gstRateBp });

function quote(items: ConfirmableQuotation['items'], discount = 0, status = 'SENT'): ConfirmableQuotation {
  const t = gstTotals(items, discount);
  return { quotationNumber: 'QTN-T', status, subtotal: t.subtotal, discount: t.discount, gstAmount: t.gst, total: t.total, items };
}

describe('planConfirmation', () => {
  test('the design’s worked example: ₹1,00,000 + 18% GST confirmed on its own → ₹1,18,000, advance ₹29,500, balance ₹88,500', () => {
    const q = quote([item('a', 100000), item('b', 50000)]);
    const r = planConfirmation({ quotation: q, chosenItemIds: ['a'], confirmed: { itemIds: [], total: 0 } });
    expect(r).toMatchObject({ ok: true, value: { subtotal: 100000, taxable: 100000, gst: 18000, total: 118000, advance: 29500, balance: 88500, isLast: false } });
  });

  test('confirmations of a quotation add up to its total exactly, with the discount shared and the rounding settled on the last', () => {
    const q = quote([item('a', 33333), item('b', 33333), item('c', 33334, 500)], 1001);
    const first = planConfirmation({ quotation: q, chosenItemIds: ['a'], confirmed: { itemIds: [], total: 0 } });
    if (!first.ok) throw new Error(first.error);
    const second = planConfirmation({ quotation: q, chosenItemIds: ['b'], confirmed: { itemIds: ['a'], total: first.value.total } });
    if (!second.ok) throw new Error(second.error);
    const last = planConfirmation({ quotation: { ...q, total: q.total + 1, gstAmount: q.gstAmount + 1 }, chosenItemIds: ['c'], confirmed: { itemIds: ['a', 'b'], total: first.value.total + second.value.total } });
    if (!last.ok) throw new Error(last.error);
    expect(last.value.isLast).toBe(true);
    expect(first.value.total + second.value.total + last.value.total).toBe(q.total + 1);
    expect(first.value.discount + second.value.discount + last.value.discount).toBe(1001);
  });

  test('refuses: nothing chosen, an unknown line, a line confirmed twice, a quotation that is not sent', () => {
    const q = quote([item('a', 1000), item('b', 2000)]);
    expect(planConfirmation({ quotation: q, chosenItemIds: [], confirmed: { itemIds: [], total: 0 } })).toMatchObject({ ok: false });
    expect(planConfirmation({ quotation: q, chosenItemIds: ['x'], confirmed: { itemIds: [], total: 0 } })).toMatchObject({ ok: false });
    expect(planConfirmation({ quotation: q, chosenItemIds: ['a'], confirmed: { itemIds: ['a'], total: 1180 } })).toMatchObject({ ok: false, error: expect.stringContaining('Already confirmed') });
    expect(planConfirmation({ quotation: { ...q, status: 'DRAFT' }, chosenItemIds: ['a'], confirmed: { itemIds: [], total: 0 } })).toMatchObject({ ok: false });
    expect(planConfirmation({ quotation: q, chosenItemIds: ['b'], confirmed: { itemIds: ['a'], total: 1180 } })).toMatchObject({ ok: true });
    expect(planConfirmation({ quotation: { ...q, status: 'ACCEPTED' }, chosenItemIds: ['a'], confirmed: { itemIds: [], total: 0 } })).toMatchObject({ ok: false });
  });

  test('GST typed as one amount (Shaadi Shopping quotations): shared in proportion to each service, adding up exactly', () => {
    const items = [item('a', 10000, null), item('b', 20000, null)];
    const q: ConfirmableQuotation = { quotationNumber: 'QTN-T2', status: 'SENT', subtotal: 30000, discount: 0, gstAmount: 5400, total: 35400, items };
    const a = planConfirmation({ quotation: q, chosenItemIds: ['a'], confirmed: { itemIds: [], total: 0 } });
    expect(a).toMatchObject({ ok: true, value: { gst: 1800, total: 11800, advance: 2950 } });
    if (!a.ok) throw new Error(a.error);
    expect(planConfirmation({ quotation: q, chosenItemIds: ['b'], confirmed: { itemIds: ['a'], total: a.value.total } })).toMatchObject({ ok: true, value: { gst: 3600, total: 23600, isLast: true } });
    expect(planConfirmation({ quotation: q, chosenItemIds: ['a', 'b'], confirmed: { itemIds: [], total: 0 } })).toMatchObject({ ok: true, value: { gst: 5400, total: 35400, advance: 8850 } });
  });

  test('a mix — some lines with a rate, a GST total that disagrees — is only confirmed all at once', () => {
    const items = [item('a', 10000, 1800), item('b', 20000, null)];
    const q: ConfirmableQuotation = { quotationNumber: 'QTN-MIX', status: 'SENT', subtotal: 30000, discount: 0, gstAmount: 5000, total: 35000, items };
    expect(planConfirmation({ quotation: q, chosenItemIds: ['a'], confirmed: { itemIds: [], total: 0 } })).toMatchObject({ ok: false, error: expect.stringContaining('does not match') });
    expect(planConfirmation({ quotation: q, chosenItemIds: ['a', 'b'], confirmed: { itemIds: [], total: 0 } })).toMatchObject({ ok: true, value: { total: 35000 } });
  });
});
