/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { dashboardStatValue } from './AdminClient';

// Production-integrity fix: the admin Dashboard tab's 6 summary cards
// (Total Vendors, Categories, Enquiries, Consultations, Bookings, Outside
// Vendors) all previously fell back to a bare `0` whenever GET /api/stats
// failed (a real, reproduced issue under fetchAll()'s 9-way simultaneous
// request burst contending for the capped Postgres connection pool from
// lib/prismaPoolConfig.ts) — indistinguishable from a real, verified-empty
// count. dashboardStatValue is the extracted decision logic behind the fix:
// show "—" only when stats has never successfully loaded at all; once
// loaded, keep showing the last real number even if a later refresh fails,
// rather than blanking real data.
describe('dashboardStatValue', () => {
  test('shows "—" when stats failed and has never loaded successfully', () => {
    expect(dashboardStatValue(true, false, undefined)).toBe('—');
  });

  test('shows the real value when stats loaded successfully, even if it is a genuine 0', () => {
    expect(dashboardStatValue(false, true, 0)).toBe(0);
  });

  test('shows the real value when stats loaded successfully and no error occurred', () => {
    expect(dashboardStatValue(false, true, 87)).toBe(87);
  });

  test('keeps showing the last real value if stats loaded once before, even though a later refresh failed', () => {
    expect(dashboardStatValue(true, true, 87)).toBe(87);
  });

  test('shows 0 (not "—") during the initial in-flight load, before any error has occurred', () => {
    expect(dashboardStatValue(false, false, undefined)).toBe(0);
  });
});
