/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { ValidationError } from '@/lib/errors';
import { UNASSIGNED_VENDOR_NAME } from '@/lib/booking/unassigned';
import { isPlausibleDate, planBookingFromQuotation, resolveSourceDate, type BookingSource, type QuotedForBooking } from './booking';

const source: BookingSource = {
  name: 'Rahul Sharma',
  phone: '9876543210',
  city: 'Patna',
  dateText: '2026-11-20',
  guestCount: 500,
  eventType: 'wedding',
};

const quotation: QuotedForBooking = {
  total: 690000, // 700000 subtotal − 10000 discount
  items: [
    { description: 'Grand Ballroom', category: 'Venues', functionLabel: null, vendorId: 'v-venue', unitPrice: 300000, quantity: 1 },
    { description: 'Catering per plate', category: 'Catering', functionLabel: 'Wedding', vendorId: 'v-cater', unitPrice: 800, quantity: 500 },
    { description: 'Custom stage', category: 'Decorators', functionLabel: null, vendorId: null, unitPrice: 0, quantity: 1 },
  ],
};

const vendors = new Map([
  ['v-venue', { name: 'The Grand Palace', categoryName: 'Venues' }],
  ['v-cater', { name: 'Royal Feast Catering', categoryName: 'Catering' }],
]);

describe('resolveSourceDate — only an exact, plausible YYYY-MM-DD is trusted', () => {
  test('accepts a clear date', () => {
    expect(resolveSourceDate('2026-11-20')?.toISOString()).toBe('2026-11-20T00:00:00.000Z');
  });

  test.each([
    ['20 October 20202', 'the typo the real data contains (JS parses it as year 20202)'],
    ['20 October 2026', 'free text, even a sensible one'],
    ['2026-13-01', 'month 13'],
    ['2026-02-31', 'a rollover date'],
    ['2026-11-20T10:00:00Z', 'a timestamp'],
    ['1999-01-01', 'implausibly old'],
    ['2101-01-01', 'implausibly far'],
    ['', 'empty'],
  ])('rejects %p (%s)', (raw) => {
    expect(resolveSourceDate(raw)).toBeNull();
  });

  test('null and undefined are "unknown"', () => {
    expect(resolveSourceDate(null)).toBeNull();
    expect(resolveSourceDate(undefined)).toBeNull();
  });

  test('isPlausibleDate guards an override the same way', () => {
    expect(isPlausibleDate(new Date('2026-11-20'))).toBe(true);
    expect(isPlausibleDate(new Date('20202-10-20'))).toBe(false);
    expect(isPlausibleDate(new Date('nope'))).toBe(false);
  });
});

describe('planBookingFromQuotation', () => {
  test('carries the client, city, date and guests from the source, and the QUOTE total (not the sum of the lines)', () => {
    const plan = planBookingFromQuotation({ quotation, source, vendors });
    expect(plan).toMatchObject({
      name: 'Rahul Sharma',
      phone: '9876543210',
      city: 'Patna',
      total: 690000,
      guestCount: 500,
      weddingType: 'wedding',
    });
    expect(plan.weddingDate.toISOString()).toBe('2026-11-20T00:00:00.000Z');
  });

  test('every line keeps its quoted unit price and quantity — prices come from the quote, not a package list', () => {
    const plan = planBookingFromQuotation({ quotation, source, vendors });
    expect(plan.items[1]).toEqual({
      vendorId: 'v-cater',
      vendorName: 'Royal Feast Catering',
      vendorCategory: 'Catering',
      packageName: 'Catering per plate (Wedding)',
      price: 800,
      quantity: 500,
    });
  });

  test('a vendor line takes the vendor\'s real name and category', () => {
    const plan = planBookingFromQuotation({ quotation, source, vendors });
    expect(plan.items[0]).toMatchObject({ vendorId: 'v-venue', vendorName: 'The Grand Palace', vendorCategory: 'Venues', packageName: 'Grand Ballroom' });
  });

  test('a custom line becomes an unassigned item so conversion creates a "pick a vendor" task', () => {
    const plan = planBookingFromQuotation({ quotation, source, vendors });
    expect(plan.items[2]).toEqual({
      vendorId: null,
      vendorName: UNASSIGNED_VENDOR_NAME,
      vendorCategory: 'Decorators',
      packageName: 'Custom stage',
      price: 0,
      quantity: 1,
    });
  });

  test('a custom line with no category falls back to "Service"', () => {
    const plan = planBookingFromQuotation({
      quotation: { total: 10, items: [{ description: 'Misc', category: null, functionLabel: null, vendorId: null, unitPrice: 10, quantity: 1 }] },
      source,
      vendors,
    });
    expect(plan.items[0].vendorCategory).toBe('Service');
  });

  test('a vendor that no longer exists is an error, never silently turned into an unassigned line', () => {
    expect(() =>
      planBookingFromQuotation({
        quotation: { total: 5, items: [{ description: 'Gone', category: null, functionLabel: null, vendorId: 'v-deleted', unitPrice: 5, quantity: 1 }] },
        source,
        vendors,
      })
    ).toThrow('no longer exists');
  });

  test('a source date that is free text needs the wedding date from staff — and fails clearly without it', () => {
    const noDate = { ...source, dateText: '20 October 20202' };
    const err = (() => {
      try {
        planBookingFromQuotation({ quotation, source: noDate, vendors });
      } catch (e) {
        return e as Error;
      }
      return null;
    })();
    expect(err).toBeInstanceOf(ValidationError);
    expect(err?.message).toContain('Add the wedding date');

    const plan = planBookingFromQuotation({ quotation, source: noDate, vendors, overrides: { weddingDate: new Date('2026-12-05') } });
    expect(plan.weddingDate.toISOString()).toBe('2026-12-05T00:00:00.000Z');
  });

  test('an override beats the source for date, guests, type and city', () => {
    const plan = planBookingFromQuotation({
      quotation,
      source,
      vendors,
      overrides: { weddingDate: new Date('2026-12-05'), guestCount: 300, weddingType: 'Sangeet', city: 'Ranchi' },
    });
    expect(plan).toMatchObject({ city: 'Ranchi', guestCount: 300, weddingType: 'Sangeet' });
    expect(plan.weddingDate.toISOString()).toBe('2026-12-05T00:00:00.000Z');
  });

  test('a missing city (consultations may have none) must be supplied', () => {
    expect(() => planBookingFromQuotation({ quotation, source: { ...source, city: null }, vendors })).toThrow('Add the city');
    expect(planBookingFromQuotation({ quotation, source: { ...source, city: '  ' }, vendors, overrides: { city: 'Gaya' } }).city).toBe('Gaya');
  });

  test('an implausible override year is rejected', () => {
    expect(() => planBookingFromQuotation({ quotation, source, vendors, overrides: { weddingDate: new Date('20202-10-20') } })).toThrow(
      'does not look right'
    );
  });

  test('guest count must be a positive whole number when present; absent is allowed', () => {
    expect(() => planBookingFromQuotation({ quotation, source, vendors, overrides: { guestCount: 0 } })).toThrow('Guest count');
    expect(() => planBookingFromQuotation({ quotation, source, vendors, overrides: { guestCount: 2.5 } })).toThrow('Guest count');
    expect(planBookingFromQuotation({ quotation, source: { ...source, guestCount: null }, vendors }).guestCount).toBeNull();
  });

  test('a quotation with no lines cannot be booked', () => {
    expect(() => planBookingFromQuotation({ quotation: { total: 0, items: [] }, source, vendors })).toThrow('no lines');
  });
});
