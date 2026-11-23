import { describe, expect, it } from 'bun:test';
import { allocate, isCalendarDate, scheduleBalance, validateSchedule } from './schedule';

describe('scheduleBalance', () => {
  it('is the agreement total less the booking amount', () => {
    expect(scheduleBalance(85500, 21375)).toBe(64125);
    expect(scheduleBalance(1000, 5000)).toBe(0); // a booking amount above the total never makes a negative balance
  });
});

describe('validateSchedule', () => {
  const ok = [
    { label: 'Before the wedding', amount: 40000, dueDate: '2026-11-27' },
    { label: 'On the wedding day', amount: 24125, dueDate: '2026-11-30' },
  ];
  it('accepts instalments that add up to the balance exactly', () => {
    expect(validateSchedule(ok, 64125)).toEqual([]);
  });
  it('an empty schedule is valid (no dates set yet)', () => {
    expect(validateSchedule([], 64125)).toEqual([]);
  });
  it('refuses a schedule one rupee short or over', () => {
    const short = validateSchedule([{ ...ok[0] }, { ...ok[1], amount: 24124 }], 64125);
    expect(short.map((p) => p.code)).toEqual(['SUM']);
    expect(short[0]).toMatchObject({ difference: 1 });
    expect(short[0].message).toContain('₹1 is not scheduled');
    const over = validateSchedule([{ ...ok[0] }, { ...ok[1], amount: 24126 }], 64125);
    expect(over[0]).toMatchObject({ code: 'SUM', difference: -1 });
    expect(over[0].message).toContain('₹1 too much');
  });
  it('refuses zero, negative and fractional amounts', () => {
    for (const amount of [0, -5, 10.5, Number.NaN]) {
      const p = validateSchedule([{ ...ok[0], amount }], 40000);
      expect(p.some((x) => x.code === 'AMOUNT')).toBe(true);
    }
  });
  it('refuses missing, impossible and out-of-order dates, and empty or long names', () => {
    expect(validateSchedule([{ ...ok[0], dueDate: '' }], 40000).map((p) => p.code)).toContain('DATE');
    expect(validateSchedule([{ ...ok[0], dueDate: '2026-02-30' }], 40000).map((p) => p.code)).toContain('DATE');
    expect(validateSchedule([ok[1], ok[0]], 64125).map((p) => p.code)).toContain('ORDER');
    expect(validateSchedule([{ ...ok[0], label: '  ' }], 40000).map((p) => p.code)).toContain('LABEL');
    expect(validateSchedule([{ ...ok[0], label: 'x'.repeat(61) }], 40000).map((p) => p.code)).toContain('LABEL');
  });
  it('refuses more than 12 instalments', () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ label: `#${i + 1}`, amount: 1, dueDate: '2026-12-01' }));
    expect(validateSchedule(many, 13).map((p) => p.code)).toEqual(['TOO_MANY']);
  });
});

describe('isCalendarDate', () => {
  it('only real YYYY-MM-DD dates', () => {
    expect(isCalendarDate('2026-11-30')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('30-11-2026')).toBe(false);
  });
});

describe('allocate', () => {
  const steps = [
    { label: 'Booking amount', amount: 21375, dueDate: null },
    { label: 'Before the wedding', amount: 40000, dueDate: '2026-11-27' },
    { label: 'On the day', amount: 24125, dueDate: '2026-11-30' },
  ];
  it('fills the booking amount first, then instalments in order', () => {
    const r = allocate(steps, 30000, '2026-11-22');
    expect(r.map((s) => [s.paid, s.remaining, s.status])).toEqual([
      [21375, 0, 'PAID'],
      [8625, 31375, 'PART_PAID'],
      [0, 24125, 'DUE'],
    ]);
  });
  it('an unpaid instalment past its date is overdue; a paid one never is', () => {
    const r = allocate(steps, 61375, '2026-12-01');
    expect(r.map((s) => s.status)).toEqual(['PAID', 'PAID', 'OVERDUE']);
  });
  it('the paid amounts always add up to what was received (capped at the total)', () => {
    for (const received of [0, 1, 21375, 50000, 85500, 99999]) {
      const r = allocate(steps, received, '2026-11-22');
      expect(r.reduce((s, x) => s + x.paid, 0)).toBe(Math.min(received, 85500));
    }
  });
});
