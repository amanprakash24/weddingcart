// "Availability" in Vendor OS (12 Oct 2026): a month calendar of the dates a business has already given away — its OWN bookings
// (made from its own accepted quotations), confirmed or not yet confirmed. Pure and browser-safe: services/venueCalendar.service.ts
// loads the bookings, this says what each day shows. What counts is the same as the same-date warning (lib/venue/sameDate.ts): a
// closed booking frees its date; nothing here ever blocks a booking.
//
// Not shown yet: dates the business blocks by hand, the functions of a wedding moved to another day, and Shaadi Shopping's own
// weddings this business is booked on.

import type { SameDateBooking } from './sameDate';

export type CalendarBooking = SameDateBooking;

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  bookings: CalendarBooking[]; // confirmed first
}

export interface VenueCalendar {
  today: string; // YYYY-MM-DD in India
  from: string; // first day shown: the 1st of this month
  to: string; // first day NOT shown: the 1st of the month after the last one
  months: string[]; // YYYY-MM, this month first
  days: CalendarDay[]; // only the days with a booking, in order
  truncated: boolean; // more bookings than one answer carries — the latest ones are left out
}

export const CALENDAR_MONTHS = 12;
export const CALENDAR_MAX_BOOKINGS = 500;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const istDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);

// "2026-10" + n months → "2027-02".
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

// The months shown — this month (in India) and the next ones — and the range of wedding dates to load for them. A wedding date is
// stored as the start of its day in UTC (lib/quotation/booking.ts), so the range is in whole UTC days.
export function calendarWindow(now: Date, months = CALENDAR_MONTHS) {
  const today = istDay(now);
  const first = today.slice(0, 7);
  const list = Array.from({ length: months }, (_, i) => addMonths(first, i));
  const from = `${first}-01`;
  const to = `${addMonths(first, months)}-01`;
  return { today, months: list, from, to, range: { gte: new Date(`${from}T00:00:00.000Z`), lt: new Date(`${to}T00:00:00.000Z`) } };
}

type Row = { name: string; status: string; weddingDate: Date | null; consultationId: string | null; wedding: { id: string; weddingNumber: string } | null };

export function buildCalendar(rows: Row[], now: Date, months = CALENDAR_MONTHS, max = CALENDAR_MAX_BOOKINGS): VenueCalendar {
  const w = calendarWindow(now, months);
  const byDay = new Map<string, CalendarBooking[]>();
  for (const r of rows) {
    if (!r.weddingDate || r.status === 'CLOSED') continue;
    const date = r.weddingDate.toISOString().slice(0, 10);
    if (!DAY.test(date) || date < w.from || date >= w.to) continue;
    const list = byDay.get(date) ?? [];
    list.push({ name: r.name, confirmed: r.status === 'CONFIRMED', enquiryId: r.consultationId, wedding: r.wedding ? { id: r.wedding.id, number: r.wedding.weddingNumber } : null });
    byDay.set(date, list);
  }
  const days = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, bookings]) => ({ date, bookings: bookings.sort((a, b) => Number(b.confirmed) - Number(a.confirmed)) }));
  return { today: w.today, from: w.from, to: w.to, months: w.months, days, truncated: rows.length >= max };
}

// What one day shows: a confirmed booking wins over one that is not confirmed yet.
export type DayMark = 'CONFIRMED' | 'NOT_CONFIRMED' | null;
export function dayMark(bookings: readonly CalendarBooking[] | undefined): DayMark {
  if (!bookings?.length) return null;
  return bookings.some((b) => b.confirmed) ? 'CONFIRMED' : 'NOT_CONFIRMED';
}

// The month as weeks of 7 cells, Sunday first; null = a blank cell before the 1st or after the last day.
export function monthGrid(month: string): (string | null)[][] {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

export const monthWords = (month: string) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00.000Z`));
export const dayWords = (day: string) => new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00.000Z`));
