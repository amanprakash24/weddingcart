/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import {
  dashboardStatValue,
  resolveEnquiryWeddingDate,
  buildBookingCreateItems,
  type StatsState,
  type BookingCreateVendorContext,
} from './AdminClient';

// Production-integrity fix: the admin Dashboard tab's 6 summary cards
// (Total Vendors, Categories, Enquiries, Consultations, Bookings, Outside
// Vendors) all previously fell back to a bare `0` whenever GET /api/stats
// failed (a real, reproduced issue under fetchAll()'s 9-way simultaneous
// request burst contending for the capped Postgres connection pool from
// lib/prismaPoolConfig.ts) — indistinguishable from a real, verified-empty
// count. dashboardStatValue is the extracted decision logic behind the fix,
// now against the explicit StatsState discriminated union (loading / error
// with optional lastGood / success): a loading skeleton while nothing has
// been heard back yet, "—" only when the fetch failed and there is no
// prior successful load at all, and the real number otherwise — a fresh
// success, or the last known-good value carried forward through a failed
// refresh, never a fake 0.
const fakeStats = {
  vendors: 87, categories: 22, enquiries: 1, consultations: 22,
  newEnquiries: 0, newConsultations: 0, bookings: 8, newBookings: 0,
  outsideVendors: 2, newOutsideVendors: 0, leads: 0, revenue: 0,
};

describe('dashboardStatValue', () => {
  test('shows a loading skeleton before any response has ever come back', () => {
    const state: StatsState = { status: 'loading' };
    expect(dashboardStatValue(state, 'vendors')).toEqual({ kind: 'loading' });
  });

  test('shows "—" when the fetch failed and there is no prior successful load', () => {
    const state: StatsState = { status: 'error', lastGood: null };
    expect(dashboardStatValue(state, 'vendors')).toEqual({ kind: 'unavailable' });
  });

  test('shows the real value — including a genuine 0 — on a successful load', () => {
    const state: StatsState = { status: 'success', data: { ...fakeStats, leads: 0 } };
    expect(dashboardStatValue(state, 'leads')).toEqual({ kind: 'value', value: 0 });
  });

  test('shows the real non-zero value on a successful load', () => {
    const state: StatsState = { status: 'success', data: fakeStats };
    expect(dashboardStatValue(state, 'vendors')).toEqual({ kind: 'value', value: 87 });
  });

  test('keeps showing the last known-good value when a later refresh fails, instead of blanking it', () => {
    const state: StatsState = { status: 'error', lastGood: fakeStats };
    expect(dashboardStatValue(state, 'bookings')).toEqual({ kind: 'value', value: 8 });
  });

  test('reads the correct field per card', () => {
    const state: StatsState = { status: 'success', data: fakeStats };
    expect(dashboardStatValue(state, 'categories')).toEqual({ kind: 'value', value: 22 });
    expect(dashboardStatValue(state, 'consultations')).toEqual({ kind: 'value', value: 22 });
    expect(dashboardStatValue(state, 'outsideVendors')).toEqual({ kind: 'value', value: 2 });
  });
});

// Enquiry -> Booking "Create Booking" form — the two pure functions behind
// its date pre-fill/flagging and its package-selection/payload logic.
describe('resolveEnquiryWeddingDate', () => {
  test('carries forward a real YYYY-MM-DD eventDate with no warning', () => {
    expect(resolveEnquiryWeddingDate('2027-02-14')).toEqual({ weddingDate: '2027-02-14', warning: '' });
  });

  test('flags a malformed free-text date ("20 October 20202") instead of carrying it forward', () => {
    // Confirms this is the real trap being guarded against: JS Date parses
    // it into a *valid* (nonsensical) date rather than failing outright.
    expect(isNaN(new Date('20 October 20202').getTime())).toBe(false);
    expect(resolveEnquiryWeddingDate('20 October 20202')).toEqual({
      weddingDate: '',
      warning: 'This enquiry\'s event date ("20 October 20202") isn\'t valid — pick a date below.',
    });
  });

  test('leaves both empty when the enquiry has no eventDate at all', () => {
    expect(resolveEnquiryWeddingDate(undefined)).toEqual({ weddingDate: '', warning: '' });
    expect(resolveEnquiryWeddingDate('')).toEqual({ weddingDate: '', warning: '' });
  });

  test('flags a non-string eventDate defensively', () => {
    expect(resolveEnquiryWeddingDate(12345)).toEqual({ weddingDate: '', warning: '' });
  });
});

describe('buildBookingCreateItems', () => {
  const vendor: BookingCreateVendorContext = {
    slug: 'royal-caterers-patna',
    name: 'Royal Caterers',
    category: 'catering',
    packages: [
      { id: 'pkg-1', name: 'Gold Package', price: 50000 },
      { id: 'pkg-2', name: 'Silver Package', price: 30000 },
    ],
  };

  test('requires at least one selected package', () => {
    expect(buildBookingCreateItems(vendor, [])).toEqual({ error: 'Select at least one package.' });
    expect(buildBookingCreateItems(vendor, [{ packageId: '', quantity: 1 }])).toEqual({
      error: 'Select at least one package.',
    });
  });

  test('uses the vendor slug, never a UUID, for every item', () => {
    const result = buildBookingCreateItems(vendor, [{ packageId: 'pkg-1', quantity: 1 }]);
    expect('items' in result && result.items[0].vendorId).toBe('royal-caterers-patna');
  });

  test('builds one item per selected package with the correct price/quantity and computes the total', () => {
    const result = buildBookingCreateItems(vendor, [
      { packageId: 'pkg-1', quantity: 2 },
      { packageId: 'pkg-2', quantity: 1 },
    ]);
    expect(result).toEqual({
      items: [
        { vendorId: 'royal-caterers-patna', vendorName: 'Royal Caterers', vendorCategory: 'catering', packageName: 'Gold Package', price: 50000, quantity: 2 },
        { vendorId: 'royal-caterers-patna', vendorName: 'Royal Caterers', vendorCategory: 'catering', packageName: 'Silver Package', price: 30000, quantity: 1 },
      ],
      total: 50000 * 2 + 30000,
    });
  });

  test('ignores rows with no package selected, keeping only the valid ones', () => {
    const result = buildBookingCreateItems(vendor, [
      { packageId: 'pkg-1', quantity: 1 },
      { packageId: '', quantity: 1 },
    ]);
    expect('items' in result && result.items).toHaveLength(1);
  });

  test('floors quantity at 1, never producing a zero or negative quantity', () => {
    const result = buildBookingCreateItems(vendor, [{ packageId: 'pkg-1', quantity: 0 }]);
    expect('items' in result && result.items[0].quantity).toBe(1);
  });
});
