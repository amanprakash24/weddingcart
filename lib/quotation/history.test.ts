/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { buildVersionHistory, describeChanges, negotiationSteps, type HistoryQuotation } from './history';

const line = (description: string, unitPrice: number, quantity = 1) => ({ description, unitPrice, quantity });
function q(over: Partial<HistoryQuotation> & Pick<HistoryQuotation, 'revision' | 'total'>): HistoryQuotation {
  return {
    id: `q${over.revision}`, quotationNumber: `QTN-${over.revision}`, status: 'SUPERSEDED', discount: 5000, advanceAmount: 50000, terms: 'T&C',
    sentAt: `2026-09-2${over.revision}T10:00:00.000Z`, acceptedAt: null, createdAt: `2026-09-2${over.revision}T09:00:00.000Z`,
    items: [line('Hall', 60000), line('Catering', 250, 150), line('Decoration', 20000), line('Photography', 12500)],
    ...over,
  };
}
const q1 = q({ revision: 1, total: 125000 });
const q2 = q({ revision: 2, total: 118000, items: [line('Hall', 60000), line('Catering', 250, 150), line('Decoration', 13000), line('Photography', 12500)] });
const q3 = q({ revision: 3, total: 110000, status: 'SENT', discount: 5500, terms: 'T&C v3', items: [line('Hall', 60000), line('Catering', 200, 150), line('Decoration', 13000), line('Photography', 12500)] });

describe('describeChanges', () => {
  test('names the total and the line that moved', () => {
    expect(describeChanges(q1, q2)).toEqual(['Total ₹1,25,000 → ₹1,18,000', 'Decoration ₹20,000 → ₹13,000']);
  });
  test('discount and terms changes are reported', () => {
    expect(describeChanges(q2, q3)).toEqual(['Total ₹1,18,000 → ₹1,10,000', 'Catering ₹37,500 → ₹30,000', 'Discount ₹5,000 → ₹5,500', 'Terms & conditions changed']);
  });
  test('added and removed lines, and an advance change', () => {
    const next = q({ revision: 4, total: 118000, advanceAmount: 60000, items: [line('Hall', 60000), line('Catering', 250, 150), line('DJ', 8000), line('Photography', 12500)] });
    const changes = describeChanges(q1, next);
    expect(changes).toContain('Added DJ (₹8,000)');
    expect(changes).toContain('Removed Decoration');
    expect(changes).toContain('Advance ₹50,000 → ₹60,000');
  });
  test('whitespace-only edits to the terms are not a change; identical versions have no changes', () => {
    expect(describeChanges(q1, { ...q1, terms: ' T&C ' })).toEqual([]);
    expect(describeChanges(q1, q1)).toEqual([]);
  });
});

describe('buildVersionHistory', () => {
  test('oldest first, all versions kept, the first has no changes, the current one is marked', () => {
    const rows = buildVersionHistory([q3, q1, q2], 'q3');
    expect(rows.map((r) => r.quotationNumber)).toEqual(['QTN-1', 'QTN-2', 'QTN-3']);
    expect(rows.map((r) => r.total)).toEqual([125000, 118000, 110000]);
    expect(rows[0].changes).toEqual([]);
    expect(rows[1].changes.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.isCurrent)).toEqual([false, false, true]);
  });
  test('the date is when it was sent, or created for a draft', () => {
    const draft = q({ revision: 2, total: 1, status: 'DRAFT', sentAt: null });
    expect(buildVersionHistory([draft], null)[0].date).toBe(draft.createdAt);
    expect(buildVersionHistory([q1], null)[0].date).toBe(q1.sentAt as string);
  });
});

describe('negotiationSteps', () => {
  const state = (steps: ReturnType<typeof negotiationSteps>) => steps?.map((s) => `${s.key}:${s.state}`);
  test('nothing sent yet → no steps', () => {
    expect(negotiationSteps([q({ revision: 1, total: 1, status: 'DRAFT', sentAt: null })])).toBeNull();
  });
  test('first quotation sent → waiting for the customer', () => {
    expect(state(negotiationSteps([q({ revision: 1, total: 1, status: 'SENT' })]))).toEqual(['sent:done', 'negotiation:todo', 'revised-sent:todo', 'accepted:current']);
  });
  test('revised but not yet re-sent → the revised quotation is what is next', () => {
    const draft = q({ revision: 2, total: 1, status: 'DRAFT', sentAt: null });
    expect(state(negotiationSteps([q1, draft]))).toEqual(['sent:done', 'negotiation:done', 'revised-sent:current', 'accepted:todo']);
  });
  test('revised quotation sent → waiting for acceptance', () => {
    expect(state(negotiationSteps([q1, q2, q3]))).toEqual(['sent:done', 'negotiation:done', 'revised-sent:done', 'accepted:current']);
  });
  test('accepted → all done, none current', () => {
    expect(state(negotiationSteps([q1, q2, { ...q3, status: 'ACCEPTED', acceptedAt: '2026-09-25T00:00:00.000Z' }]))).toEqual(['sent:done', 'negotiation:done', 'revised-sent:done', 'accepted:done']);
  });
  test('accepted at once, without negotiating: steps 2 and 3 stay undone', () => {
    expect(state(negotiationSteps([{ ...q1, status: 'ACCEPTED' }]))).toEqual(['sent:done', 'negotiation:todo', 'revised-sent:todo', 'accepted:done']);
  });
  test('a declined quotation with nothing open has no current step', () => {
    expect(state(negotiationSteps([{ ...q1, status: 'REJECTED' }]))).toEqual(['sent:done', 'negotiation:todo', 'revised-sent:todo', 'accepted:todo']);
  });
});
