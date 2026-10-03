/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { groupByFunction, nextStep, proposalHighlights, proposalStatus, quotationSummary, REQUEST_CHOICES, tabFromHash } from './proposalView';

const item = (functionLabel: string | null, description = 'x') => ({ service: null, functionLabel, description, vendor: null, quantity: 1, unitPrice: 1, lineTotal: 1 });

describe('proposalStatus', () => {
  test('plain words for every state', () => {
    expect(proposalStatus({ state: 'OPEN', changesRequested: false, booked: false }).label).toBe('Awaiting your response');
    expect(proposalStatus({ state: 'OPEN', changesRequested: true, booked: false }).label).toBe('Changes requested');
    expect(proposalStatus({ state: 'ACCEPTED', changesRequested: false, booked: false }).label).toBe('Accepted');
    expect(proposalStatus({ state: 'ACCEPTED', changesRequested: false, booked: true }).label).toBe('Booked');
    expect(proposalStatus({ state: 'EXPIRED', changesRequested: false, booked: false }).label).toBe('Expired');
  });
});

describe('groupByFunction — only when every line has a function; never guessed', () => {
  test('every line has a function → grouped in first-appearance order (case-insensitive)', () => {
    const groups = groupByFunction([item('Wedding', 'a'), item('Mehndi', 'b'), item('wedding', 'c')]);
    expect(groups.map((g) => [g.title, g.items.map((i) => i.description)])).toEqual([['Wedding', ['a', 'c']], ['Mehndi', ['b']]]);
  });

  test('one line without a function → a single list in the quote order', () => {
    const groups = groupByFunction([item('Wedding', 'a'), item(null, 'b'), item(' ', 'c')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBeNull();
    expect(groups[0].items.map((i) => i.description)).toEqual(['a', 'b', 'c']);
  });

  test('no lines → no groups', () => {
    expect(groupByFunction([])).toEqual([]);
  });
});

describe('nextStep', () => {
  test('accepted: the advance from the proposal; booked: confirmed; expired and changes requested', () => {
    expect(nextStep({ state: 'ACCEPTED', changesRequested: false, booked: false, advanceAmount: 59337 })).toContain('₹59,337');
    expect(nextStep({ state: 'ACCEPTED', changesRequested: false, booked: false, advanceAmount: 0 })).not.toContain('₹');
    expect(nextStep({ state: 'ACCEPTED', changesRequested: false, booked: true, advanceAmount: 59337 })).toContain('booking is confirmed');
    expect(nextStep({ state: 'EXPIRED', changesRequested: false, booked: false, advanceAmount: 0 })).toContain('expired');
    expect(nextStep({ state: 'OPEN', changesRequested: true, booked: false, advanceAmount: 0 })).toContain('request for changes');
    expect(nextStep({ state: 'OPEN', changesRequested: false, booked: false, advanceAmount: 0 })).toContain('review the detailed quotation and accept it there');
  });
});

describe('proposal vs detailed quotation (Decision 10)', () => {
  const money = { subtotal: 300000, discount: 10000, gstAmount: 52200, total: 342200, advanceAmount: 85550 };

  test('the proposal view carries only the total and the advance — no subtotal, discount or GST', () => {
    const rows = proposalHighlights(money);
    expect(rows).toEqual([{ label: 'Total for your wedding', amount: 342200 }, { label: 'Advance to confirm', amount: 85550 }]);
    expect(JSON.stringify(rows)).not.toMatch(/subtotal|discount|gst/i);
    expect(proposalHighlights({ total: 1000, advanceAmount: 0 })).toHaveLength(1);
  });

  test('the detailed quotation adds up: subtotal − discount + GST = total; balance = total − advance', () => {
    const rows = quotationSummary(money);
    const get = (label: string) => rows.find((r) => r.label === label)?.amount;
    expect(rows.map((r) => r.label)).toEqual(['Subtotal', 'Discount', 'GST', 'Total', 'Advance to confirm', 'Balance']);
    expect(get('Subtotal')! - get('Discount')! + get('GST')!).toBe(get('Total')!);
    expect(get('Balance')).toBe(342200 - 85550);
  });

  test('no discount, no GST, no advance → those rows are simply not there', () => {
    expect(quotationSummary({ subtotal: 5000, discount: 0, gstAmount: null, total: 5000, advanceAmount: 0 }).map((r) => r.label)).toEqual(['Subtotal', 'Total']);
  });

  test('#quotation opens the detailed quotation; anything else is the proposal', () => {
    expect(tabFromHash('#quotation')).toBe('quotation');
    expect(tabFromHash('#Quotation')).toBe('quotation');
    for (const h of ['', '#', '#proposal', '#register']) expect(tabFromHash(h)).toBe('proposal');
  });

  test('request-change quick choices only start the note', () => {
    expect(REQUEST_CHOICES.map((c) => c.label)).toEqual(['Show me another option', 'I have a question', 'Change something else']);
    for (const c of REQUEST_CHOICES) expect(c.start.length).toBeGreaterThan(5);
  });
});
