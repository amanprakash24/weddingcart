/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { addMonths, buildCalendar, calendarWindow, dayMark, monthGrid } from './calendar';

// 12 Oct 2026, 23:00 in India = 17:30 UTC.
const NOW = new Date('2026-10-12T17:30:00.000Z');
const row = (date: string | null, status = 'CONFIRMED', name = 'Riya & Arjun', extra: Partial<{ consultationId: string; wedding: { id: string; weddingNumber: string } }> = {}) => ({
  name,
  status,
  weddingDate: date ? new Date(`${date}T00:00:00.000Z`) : null,
  consultationId: extra.consultationId ?? 'enq-1',
  wedding: extra.wedding ?? null,
});

describe('calendarWindow', () => {
  test('this month in India and the 11 after it', () => {
    const w = calendarWindow(NOW);
    expect(w).toMatchObject({ today: '2026-10-12', from: '2026-10-01', to: '2027-10-01' });
    expect(w.months[0]).toBe('2026-10');
    expect(w.months[11]).toBe('2027-09');
    expect(w.range.gte.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  test('late on the last evening of a month in India, it is already the next month', () => {
    // 31 Oct 2026, 19:00 UTC = 1 Nov 00:30 in India.
    expect(calendarWindow(new Date('2026-10-31T19:00:00.000Z'))).toMatchObject({ today: '2026-11-01', from: '2026-11-01' });
  });

  test('addMonths crosses years', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
  });
});

describe('buildCalendar', () => {
  test('each booked day once, in order, confirmed first; links to the wedding or the enquiry', () => {
    const c = buildCalendar(
      [row('2026-12-05', 'NEW', 'Sita & Ram', { consultationId: 'enq-2' }), row('2026-11-20', 'CONFIRMED', 'A', { wedding: { id: 'w1', weddingNumber: 'KUS-WED-1' } }), row('2026-12-05', 'CONFIRMED', 'B')],
      NOW
    );
    expect(c.days.map((d) => d.date)).toEqual(['2026-11-20', '2026-12-05']);
    expect(c.days[0].bookings[0]).toEqual({ name: 'A', confirmed: true, enquiryId: 'enq-1', wedding: { id: 'w1', number: 'KUS-WED-1' } });
    expect(c.days[1].bookings.map((b) => [b.name, b.confirmed])).toEqual([['B', true], ['Sita & Ram', false]]);
    expect(c.truncated).toBe(false);
  });

  test('a closed booking frees its date; no date, or outside the months shown, is left out', () => {
    const c = buildCalendar([row('2026-11-01', 'CLOSED'), row(null), row('2026-09-30'), row('2027-10-01'), row('2026-10-01')], NOW);
    expect(c.days.map((d) => d.date)).toEqual(['2026-10-01']);
  });

  test('a full answer says some may be missing', () => {
    expect(buildCalendar([row('2026-11-01'), row('2026-11-02')], NOW, 12, 2).truncated).toBe(true);
  });
});

describe('dayMark', () => {
  test('confirmed wins; nothing booked is no mark', () => {
    expect(dayMark([{ name: 'a', confirmed: false, enquiryId: null, wedding: null }, { name: 'b', confirmed: true, enquiryId: null, wedding: null }])).toBe('CONFIRMED');
    expect(dayMark([{ name: 'a', confirmed: false, enquiryId: null, wedding: null }])).toBe('NOT_CONFIRMED');
    expect(dayMark([])).toBeNull();
    expect(dayMark(undefined)).toBeNull();
  });
});

describe('monthGrid', () => {
  test('October 2026 starts on a Thursday: 4 blanks, 31 days, whole weeks of 7, blanks after the last day', () => {
    const g = monthGrid('2026-10');
    expect(g[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(g.flat().filter(Boolean)).toHaveLength(31);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g.at(-1)?.at(-1)).toBe('2026-10-31'); // 4 + 31 = 35: exactly five weeks
    expect(monthGrid('2026-11').at(-1)?.at(-1)).toBeNull(); // Nov ends on a Monday
  });

  test('February in a leap year', () => {
    expect(monthGrid('2028-02').flat().filter(Boolean).at(-1)).toBe('2028-02-29');
  });
});
