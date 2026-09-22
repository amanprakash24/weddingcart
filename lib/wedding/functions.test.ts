/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { functionDeleteBlocker, functionProblem, functionSpend, normalizeFunction, primaryDateFor } from './functions';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('functionProblem', () => {
  test('an Other function must be named; a Haldi need not be', () => {
    expect(functionProblem({ type: 'OTHER', label: '  ' })).toContain('name');
    expect(functionProblem({ type: 'OTHER' })).toContain('name');
    expect(functionProblem({ type: 'OTHER', label: 'Cocktail night' })).toBeNull();
    expect(functionProblem({ type: 'HALDI' })).toBeNull();
  });
  test('start time is HH:MM, 24 hours', () => {
    expect(functionProblem({ type: 'WEDDING', startTime: '18:30' })).toBeNull();
    expect(functionProblem({ type: 'WEDDING', startTime: '7pm' })).toContain('18:30');
    expect(functionProblem({ type: 'WEDDING', startTime: '24:00' })).not.toBeNull();
    expect(functionProblem({ type: 'WEDDING', startTime: null })).toBeNull();
  });
  test('budget is a whole non-negative number or nothing; city cannot be blanked', () => {
    expect(functionProblem({ type: 'WEDDING', budget: 250000 })).toBeNull();
    expect(functionProblem({ type: 'WEDDING', budget: null })).toBeNull();
    expect(functionProblem({ type: 'WEDDING', budget: -1 })).not.toBeNull();
    expect(functionProblem({ type: 'WEDDING', budget: 10.5 })).not.toBeNull();
    expect(functionProblem({ type: 'WEDDING', city: '   ' })).toContain('city');
  });
});

describe('normalizeFunction', () => {
  test('blank text becomes nothing and the rest is trimmed; only Other keeps a name', () => {
    expect(normalizeFunction({ type: 'OTHER', label: ' Cocktail night ', venueName: '  ', city: ' Patna ', startTime: '' }) as Record<string, unknown>).toEqual({ type: 'OTHER', label: 'Cocktail night', venueName: null, city: 'Patna', startTime: null });
    expect(normalizeFunction({ type: 'HALDI', label: 'Haldi ceremony' }) as Record<string, unknown>).toEqual({ type: 'HALDI', label: null });
  });
  test('fields that were not sent stay not sent', () => {
    expect(normalizeFunction({ venueName: 'Hall' })).toEqual({ venueName: 'Hall' });
  });
});

describe('primaryDateFor', () => {
  test('follows the earliest Wedding function', () => {
    expect(primaryDateFor([{ type: 'MEHNDI', date: d('2026-11-03') }, { type: 'WEDDING', date: d('2026-11-05') }, { type: 'WEDDING', date: d('2026-11-04') }], d('2026-10-01'))).toEqual(d('2026-11-04'));
  });
  test('nothing to change when it already matches, or there is no Wedding function', () => {
    expect(primaryDateFor([{ type: 'WEDDING', date: d('2026-11-05') }], d('2026-11-05'))).toBeNull();
    expect(primaryDateFor([{ type: 'RECEPTION', date: d('2026-11-06') }], d('2026-11-05'))).toBeNull();
    expect(primaryDateFor([], d('2026-11-05'))).toBeNull();
  });
});

describe('functionDeleteBlocker', () => {
  const free = { isLastFunction: false, vendorBookings: 0, servicesWithoutVendor: 0, guestReplies: 0 };
  test('an empty function that is not the last one can go', () => {
    expect(functionDeleteBlocker(free)).toBeNull();
  });
  test('each thing attached to it says why it stays', () => {
    expect(functionDeleteBlocker({ ...free, isLastFunction: true })).toContain('at least one');
    expect(functionDeleteBlocker({ ...free, vendorBookings: 1 })).toContain('A vendor is booked');
    expect(functionDeleteBlocker({ ...free, vendorBookings: 3 })).toContain('3 vendors are booked');
    expect(functionDeleteBlocker({ ...free, servicesWithoutVendor: 1 })).toContain('quoted service');
    expect(functionDeleteBlocker({ ...free, guestReplies: 4 })).toContain('replies');
  });
});

describe('functionSpend', () => {
  const b = (status: string, agreedPrice: number) => ({ status, agreedPrice });
  test('counts waiting, confirmed and completed vendors — not declined or cancelled ones', () => {
    expect(functionSpend(100000, [b('PENDING_VENDOR_CONFIRMATION', 10000), b('CONFIRMED', 20000), b('COMPLETED', 5000), b('DECLINED', 99999), b('CANCELLED', 99999)])).toEqual({ booked: 35000, over: 0 });
  });
  test('over is how far past the budget; none without a budget', () => {
    expect(functionSpend(30000, [b('CONFIRMED', 35000)])).toEqual({ booked: 35000, over: 5000 });
    expect(functionSpend(null, [b('CONFIRMED', 35000)])).toEqual({ booked: 35000, over: 0 });
    expect(functionSpend(50000, [])).toEqual({ booked: 0, over: 0 });
  });
});
