/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { COMMERCIAL_RULES, confirmationRefusal, confirmationStatus, holdExpiry, requiredConfirmation } from './rules';

const NOW = new Date('2026-09-22T05:00:00.000Z'); // Tue 22 Sep 2026, India morning
const at = (iso: string) => new Date(iso);

describe('the rules live in one place', () => {
  test('25%, 7 days, rounded up to the rupee', () => {
    expect(COMMERCIAL_RULES).toEqual({ confirmationPercent: 25, holdWindowDays: 7, rounding: 'CEIL_RUPEE' });
  });
});

describe('requiredConfirmation', () => {
  test('exactly 25% of the accepted total', () => {
    expect(requiredConfirmation(200000)).toBe(50000);
    expect(requiredConfirmation(1250000)).toBe(312500);
  });
  test('rounds UP to the next rupee, never down', () => {
    expect(requiredConfirmation(100001)).toBe(25001); // 25000.25
    expect(requiredConfirmation(100003)).toBe(25001); // 25000.75
    expect(requiredConfirmation(100004)).toBe(25001); // 25001 exactly
    expect(requiredConfirmation(1)).toBe(1);
    expect(requiredConfirmation(3)).toBe(1); // 0.75
  });
  test('uses the percent it is given, so a later rule does not touch an old agreement', () => {
    expect(requiredConfirmation(200000, { confirmationPercent: 30 })).toBe(60000);
    expect(requiredConfirmation(200000)).toBe(50000);
  });
  test('nothing is required of a zero or invalid total', () => {
    expect(requiredConfirmation(0)).toBe(0);
    expect(requiredConfirmation(-5)).toBe(0);
    expect(requiredConfirmation(10.5)).toBe(0);
  });
});

describe('confirmationStatus — the ₹2,00,000 example', () => {
  const required = 50000;

  test('nothing received: not started', () => {
    const s = confirmationStatus({ required, received: 0, now: NOW });
    expect(s).toMatchObject({ state: 'NOT_STARTED', remaining: 50000, daysLeft: null, overdue: false });
    expect(s.message).toContain('₹50,000 is needed');
  });

  test('₹20,000 received: date held, ₹30,000 remaining, 7 of 7 days on the day of the first payment', () => {
    const s = confirmationStatus({ required, received: 20000, holdStartedAt: NOW, holdWindowDays: 7, now: NOW });
    expect(s).toMatchObject({ state: 'DATE_HELD', remaining: 30000, daysLeft: 7, overdue: false });
    expect(s.message).toBe('₹30,000 more required to confirm this booking. 7 of 7 days left to hold the date.');
  });

  test('another ₹30,000 received (₹50,000 in all): confirmed — exactly reaching 25% is enough', () => {
    const s = confirmationStatus({ required, received: 50000, holdStartedAt: NOW, now: NOW });
    expect(s).toMatchObject({ state: 'CONFIRMED', remaining: 0, daysLeft: null, overdue: false });
  });

  test('more than 25% is fine: ₹70,000 confirms it', () => {
    expect(confirmationStatus({ required, received: 70000, holdStartedAt: NOW, now: NOW })).toMatchObject({ state: 'CONFIRMED', remaining: 0 });
  });

  test('several part payments add up', () => {
    expect(confirmationStatus({ required, received: 10000 + 15000, holdStartedAt: NOW, now: NOW })).toMatchObject({ state: 'DATE_HELD', remaining: 25000 });
    expect(confirmationStatus({ required, received: 10000 + 15000 + 25000, holdStartedAt: NOW, now: NOW })).toMatchObject({ state: 'CONFIRMED' });
  });

  test('one rupee short is still only a held date', () => {
    expect(confirmationStatus({ required, received: 49999, holdStartedAt: NOW, now: NOW })).toMatchObject({ state: 'DATE_HELD', remaining: 1 });
  });
});

describe('the 7-day hold window', () => {
  const started = at('2026-09-20T09:00:00.000Z'); // Sun 20 Sep, India afternoon
  const held = (now: Date) => confirmationStatus({ required: 50000, received: 20000, holdStartedAt: started, holdWindowDays: 7, now });

  test('expires 7 days after the first payment', () => {
    expect(holdExpiry(started, 7).toISOString()).toBe('2026-09-27T09:00:00.000Z');
  });
  test('counts India calendar days: 5 days left two days in, then 1, then today, then late', () => {
    expect(held(at('2026-09-22T05:00:00.000Z')).daysLeft).toBe(5);
    expect(held(at('2026-09-26T05:00:00.000Z')).daysLeft).toBe(1);
    const today = held(at('2026-09-27T05:00:00.000Z'));
    expect(today).toMatchObject({ daysLeft: 0, overdue: false });
    expect(today.message).toContain('ends today');
  });
  test('after the window it is OVERDUE — still Date Held, never auto-released, and a person is asked to decide', () => {
    const late = held(at('2026-09-29T05:00:00.000Z'));
    expect(late).toMatchObject({ state: 'DATE_HELD', daysLeft: -2, overdue: true, remaining: 30000 });
    expect(late.message).toContain('ended 2 days ago');
    expect(late.message).toContain('decide');
  });
  test('an agreement made with a different window keeps it', () => {
    const s = confirmationStatus({ required: 50000, received: 20000, holdStartedAt: started, holdWindowDays: 14, now: at('2026-09-29T05:00:00.000Z') });
    expect(s).toMatchObject({ daysLeft: 5, overdue: false });
  });
  test('reaching the required amount after the window still confirms (payment history stays intact; nothing is refused or refunded here)', () => {
    expect(confirmationStatus({ required: 50000, received: 50000, holdStartedAt: started, holdWindowDays: 7, now: at('2026-10-15T05:00:00.000Z') })).toMatchObject({ state: 'CONFIRMED', overdue: false });
  });
});

describe('confirmationRefusal', () => {
  test('says exactly how much more is required', () => {
    expect(confirmationRefusal({ remaining: 30000 })).toBe('₹30,000 more required to confirm this booking.');
    expect(confirmationRefusal({ remaining: 1234567 })).toBe('₹12,34,567 more required to confirm this booking.');
  });
});
