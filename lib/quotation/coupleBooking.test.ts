/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { coupleBookingWords, toCoupleBooking } from './coupleBooking';

const NOW = new Date('2026-10-10T06:00:00Z'); // 10 Oct 2026, 11:30 in India
const money = (over: Record<string, unknown> = {}) => ({
  agreementTotal: 200000, received: 0, outstanding: 200000, remaining: 60000, bookingConfirmed: false,
  payments: [] as { amount: number; method: string; paidAt: string }[],
  ...over,
});
const wedding = (over: Record<string, unknown> = {}) => ({
  weddingNumber: 'KUS-WED-2026-0001', status: 'PLANNING', primaryDate: new Date('2026-12-09T00:00:00Z'),
  events: [{ type: 'HALDI', label: null, date: new Date('2026-12-09T00:00:00Z') }, { type: 'WEDDING', label: null, date: new Date('2026-12-09T00:00:00Z') }],
  ...over,
});

describe('your booking, on a business’s own link', () => {
  test('booked, nothing paid: what confirms it', () => {
    const b = toCoupleBooking(money(), null, NOW);
    expect(b).toEqual({ confirmed: false, total: 200000, received: 0, outstanding: 200000, toConfirm: 60000, payments: [], wedding: null });
    expect(coupleBookingWords(b, 'Kush Travel')).toEqual({ heading: 'Your booking', line: '₹60,000 confirms your booking with Kush Travel.' });
  });

  test('a part payment: what was received and what is still needed — newest payment first, no reference numbers', () => {
    const b = toCoupleBooking(money({ received: 20000, outstanding: 180000, remaining: 40000, payments: [
      { amount: 5000, method: 'CASH', paidAt: '2026-10-08T06:30:00.000Z', reference: 'SECRET-1', recordedByName: 'Staff' },
      { amount: 15000, method: 'BANK_TRANSFER', paidAt: '2026-10-09T20:00:00.000Z', reference: 'SECRET-2' },
    ] }), null, NOW);
    expect(b.payments).toEqual([{ amount: 15000, method: 'Bank transfer', paidOn: '2026-10-10' }, { amount: 5000, method: 'Cash', paidOn: '2026-10-08' }]);
    expect(JSON.stringify(b)).not.toContain('SECRET');
    expect(JSON.stringify(b)).not.toContain('Staff');
    expect(coupleBookingWords(b, 'Kush Travel').line).toBe('₹20,000 received. ₹40,000 more confirms your booking with Kush Travel.');
  });

  test('confirmed and now a wedding: number, date, days to go, each function once', () => {
    const b = toCoupleBooking(money({ received: 60000, outstanding: 140000, remaining: 0, bookingConfirmed: true }), wedding({ events: [...wedding().events, { type: 'HALDI', label: null, date: new Date('2026-12-09T00:00:00Z') }, { type: 'OTHER', label: ' Tilak ', date: new Date('2026-12-09T00:00:00Z') }] }), NOW);
    expect(b).toMatchObject({ confirmed: true, toConfirm: 0, outstanding: 140000 });
    expect(b.wedding).toEqual({ number: 'KUS-WED-2026-0001', date: '2026-12-09', state: 'UPCOMING', daysToGo: 60, functions: ['Haldi', 'Wedding', 'Tilak'] });
    expect(coupleBookingWords(b, 'Kush Travel')).toEqual({ heading: 'Your wedding', line: '60 days to go · Your booking with Kush Travel is confirmed.' });
  });

  test('confirmed, the wedding not made yet', () => {
    expect(coupleBookingWords(toCoupleBooking(money({ bookingConfirmed: true, remaining: 0 }), null, NOW), 'Kush Travel')).toEqual({ heading: 'Your booking', line: 'Your booking with Kush Travel is confirmed.' });
  });

  test('tomorrow, today, and after the day', () => {
    const on = (day: string) => toCoupleBooking(money({ bookingConfirmed: true }), wedding({ primaryDate: new Date(`${day}T00:00:00Z`), events: [] }), NOW);
    expect(coupleBookingWords(on('2026-10-11'), 'K').line).toStartWith('Tomorrow · ');
    expect(coupleBookingWords(on('2026-10-10'), 'K').line).toStartWith('Today is the day · ');
    expect(on('2026-10-01').wedding).toMatchObject({ state: 'UPCOMING', daysToGo: null });
    expect(coupleBookingWords(on('2026-10-01'), 'K').line).toBe('Your booking with K is confirmed.');
  });

  test('completed, postponed and cancelled say so — never a countdown', () => {
    const as = (status: string) => toCoupleBooking(money({ bookingConfirmed: true }), wedding({ status }), NOW);
    expect(as('COMPLETED').wedding).toMatchObject({ state: 'COMPLETED', daysToGo: null });
    expect(coupleBookingWords(as('COMPLETED'), 'Kush Travel').line).toBe('Thank you for celebrating with Kush Travel.');
    expect(coupleBookingWords(as('POSTPONED'), 'Kush Travel').line).toContain('postponed');
    expect(coupleBookingWords(as('CANCELLED'), 'Kush Travel').line).toContain('cancelled');
  });

  test('money never goes below zero on the page', () => {
    expect(toCoupleBooking(money({ outstanding: -5, remaining: -5 }), null, NOW)).toMatchObject({ outstanding: 0, toConfirm: 0 });
  });
});
