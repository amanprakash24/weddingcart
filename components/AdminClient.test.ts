/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { dashboardStatValue, type StatsState } from './AdminClient';

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
