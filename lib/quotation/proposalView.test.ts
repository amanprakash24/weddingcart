/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { groupByFunction, nextStep, proposalStatus } from './proposalView';

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
    expect(nextStep({ state: 'OPEN', changesRequested: false, booked: false, advanceAmount: 0 })).toContain('accept it below');
  });
});
