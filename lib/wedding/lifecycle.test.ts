/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';

// canTransitionVendorBooking/VENDOR_BOOKING_STATUS_TRANSITIONS are pure, but
// this file's *other* export (maybeActivateWedding) pulls in
// weddingRepository/activityLogRepository, which transitively import
// @/lib/prisma — which throws at import time without a real DATABASE_URL.
// Mocking @/lib/prisma before importing (same technique used elsewhere in
// this repo, e.g. services/commandCenter.service.test.ts) keeps this test
// fully self-contained — no DATABASE_URL/DB connection needed — without
// having to restructure lifecycle.ts itself.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { canTransitionVendorBooking, VENDOR_BOOKING_STATUS_TRANSITIONS } = await import('./lifecycle');

// Exhaustively covers the transition matrix authorized for this
// production-integrity fix: only the 3 transitions currently exercised by
// the real product workflow (components/wedding/workspace/WeddingEvents.tsx's
// Confirm/Decline/Mark Completed buttons). Every other transition —
// including ones a future feature might reasonably want (DECLINED retry, a
// cancel flow, CUSTOMER_APPROVAL_PENDING) — is deliberately rejected until
// that workflow is designed, not preemptively allowed.
describe('canTransitionVendorBooking', () => {
  describe('legal transitions', () => {
    test('PENDING_VENDOR_CONFIRMATION -> CONFIRMED', () => {
      expect(canTransitionVendorBooking('PENDING_VENDOR_CONFIRMATION', 'CONFIRMED')).toBe(true);
    });

    test('PENDING_VENDOR_CONFIRMATION -> DECLINED', () => {
      expect(canTransitionVendorBooking('PENDING_VENDOR_CONFIRMATION', 'DECLINED')).toBe(true);
    });

    test('CONFIRMED -> COMPLETED', () => {
      expect(canTransitionVendorBooking('CONFIRMED', 'COMPLETED')).toBe(true);
    });
  });

  describe('illegal transitions — explicitly named in the requirements', () => {
    test('DECLINED -> COMPLETED is rejected', () => {
      expect(canTransitionVendorBooking('DECLINED', 'COMPLETED')).toBe(false);
    });

    test('DECLINED -> CONFIRMED is rejected (no retry flow yet)', () => {
      expect(canTransitionVendorBooking('DECLINED', 'CONFIRMED')).toBe(false);
    });

    test('COMPLETED -> CONFIRMED is rejected (COMPLETED is terminal)', () => {
      expect(canTransitionVendorBooking('COMPLETED', 'CONFIRMED')).toBe(false);
    });

    test('COMPLETED -> DECLINED is rejected (COMPLETED is terminal)', () => {
      expect(canTransitionVendorBooking('COMPLETED', 'DECLINED')).toBe(false);
    });

    test('CANCELLED -> COMPLETED is rejected (no cancel flow exists yet)', () => {
      expect(canTransitionVendorBooking('CANCELLED', 'COMPLETED')).toBe(false);
    });

    test('CUSTOMER_APPROVAL_PENDING -> COMPLETED is rejected (undesigned feature)', () => {
      expect(canTransitionVendorBooking('CUSTOMER_APPROVAL_PENDING', 'COMPLETED')).toBe(false);
    });
  });

  describe('every other state is fully terminal in this matrix', () => {
    test('DECLINED has no legal outgoing transitions', () => {
      expect(VENDOR_BOOKING_STATUS_TRANSITIONS.DECLINED).toEqual([]);
    });

    test('CANCELLED has no legal outgoing transitions', () => {
      expect(VENDOR_BOOKING_STATUS_TRANSITIONS.CANCELLED).toEqual([]);
    });

    test('COMPLETED has no legal outgoing transitions', () => {
      expect(VENDOR_BOOKING_STATUS_TRANSITIONS.COMPLETED).toEqual([]);
    });

    test('CUSTOMER_APPROVAL_PENDING has no legal outgoing transitions', () => {
      expect(VENDOR_BOOKING_STATUS_TRANSITIONS.CUSTOMER_APPROVAL_PENDING).toEqual([]);
    });
  });

  test('PENDING_VENDOR_CONFIRMATION cannot jump straight to COMPLETED', () => {
    expect(canTransitionVendorBooking('PENDING_VENDOR_CONFIRMATION', 'COMPLETED')).toBe(false);
  });

  test('PENDING_VENDOR_CONFIRMATION cannot jump straight to CANCELLED (no cancel flow yet)', () => {
    expect(canTransitionVendorBooking('PENDING_VENDOR_CONFIRMATION', 'CANCELLED')).toBe(false);
  });

  test('CONFIRMED cannot move to CANCELLED (no cancel flow yet)', () => {
    expect(canTransitionVendorBooking('CONFIRMED', 'CANCELLED')).toBe(false);
  });

  test('CONFIRMED cannot move to CUSTOMER_APPROVAL_PENDING (undesigned feature)', () => {
    expect(canTransitionVendorBooking('CONFIRMED', 'CUSTOMER_APPROVAL_PENDING')).toBe(false);
  });
});
