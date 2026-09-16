/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { interpretBookingResponse } from './CartPageClient';

// Production-integrity fix: fetch() only rejects on a network-level
// failure — a non-2xx JSON error response from POST /api/bookings
// previously still resolved the fetch promise, so the old handleBook
// showed "Booked!" and cleared the cart on every server-side rejection.
// interpretBookingResponse is the extracted decision behind the fix.
describe('interpretBookingResponse', () => {
  test('treats a 2xx response with success:true as ok', () => {
    const result = interpretBookingResponse({ ok: true }, { success: true });
    expect(result).toEqual({ ok: true });
  });

  test('treats a 4xx/5xx response as not ok, even if it happens to include success:true', () => {
    const result = interpretBookingResponse({ ok: false }, { success: true });
    expect(result.ok).toBe(false);
  });

  test('treats a 2xx response with success:false as not ok — the actual bug scenario found in production', () => {
    const result = interpretBookingResponse({ ok: true }, { success: false, error: 'Invalid request' });
    expect(result).toEqual({ ok: false, error: 'Invalid request' });
  });

  test('uses the server-provided error message when present', () => {
    const result = interpretBookingResponse({ ok: false }, { success: false, error: 'Vendor package no longer available' });
    expect(result).toEqual({ ok: false, error: 'Vendor package no longer available' });
  });

  test('falls back to a generic message when the response body has no error field', () => {
    const result = interpretBookingResponse({ ok: false }, { success: false });
    expect(result).toEqual({ ok: false, error: 'Something went wrong on our end — please try again.' });
  });

  test('falls back to a generic message when the response body is undefined (e.g. non-JSON error page)', () => {
    const result = interpretBookingResponse({ ok: false }, undefined);
    expect(result).toEqual({ ok: false, error: 'Something went wrong on our end — please try again.' });
  });
});
