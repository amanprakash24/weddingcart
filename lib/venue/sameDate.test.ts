/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { dayRange, sameDateBookings, sameDateHeading } from './sameDate';

describe('the same-date booking warning', () => {
  test('a date is its whole day; anything that is not a real YYYY-MM-DD is not checked', () => {
    expect(dayRange('2026-12-09')).toEqual({ gte: new Date('2026-12-09T00:00:00.000Z'), lt: new Date('2026-12-10T00:00:00.000Z') });
    for (const bad of [null, undefined, '', '9 December', '2026-02-31', '2026-13-01', '20261209']) expect(dayRange(bad)).toBeNull();
  });

  const rows = [
    { name: 'Asha Singh', status: 'NEW', consultationId: 'e2', wedding: null },
    { name: 'Rahul Kumar', status: 'CONFIRMED', consultationId: 'e1', wedding: { id: 'w1', weddingNumber: 'KUS-WED-2026-0001' } },
    { name: 'Meera Jha', status: 'CONFIRMED', consultationId: 'e3', wedding: null },
    { name: 'Old Booking', status: 'CLOSED', consultationId: 'e4', wedding: null },
  ];

  test('this enquiry’s own booking and closed bookings do not count; confirmed ones come first', () => {
    expect(sameDateBookings(rows, 'e1')).toEqual([
      { name: 'Meera Jha', confirmed: true, enquiryId: 'e3', wedding: null },
      { name: 'Asha Singh', confirmed: false, enquiryId: 'e2', wedding: null },
    ]);
    expect(sameDateBookings(rows, 'e9')[0]).toEqual({ name: 'Rahul Kumar', confirmed: true, enquiryId: 'e1', wedding: { id: 'w1', number: 'KUS-WED-2026-0001' } });
    expect(sameDateBookings([], 'e1')).toEqual([]);
  });

  test('the heading says how many and whether any is confirmed', () => {
    const [confirmed, , accepted] = [sameDateBookings(rows, 'e9')[0], null, sameDateBookings(rows, 'e9')[2]];
    expect(sameDateHeading([confirmed])).toBe('You already have a confirmed booking on this date');
    expect(sameDateHeading([accepted])).toBe('Another couple has accepted a quotation for this date');
    expect(sameDateHeading([confirmed, accepted])).toBe('You already have 2 bookings on this date (1 confirmed)');
    expect(sameDateHeading([accepted, accepted])).toBe('2 other couples have accepted a quotation for this date');
  });
});
