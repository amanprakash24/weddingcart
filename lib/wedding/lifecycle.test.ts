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
const { canTransitionVendorBooking, VENDOR_BOOKING_STATUS_TRANSITIONS, canTransitionVenueBooking, VENUE_BOOKING_STATUS_TRANSITIONS } =
  await import('./lifecycle');

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

// venueStatus (services/venuePortal.service.ts) is a separate,
// vendor-portal-only physical-setup checklist with no other reader or
// writer anywhere in the codebase. Unlike VendorBooking.status above, there
// is no per-action UI and no design doc to verify specific transitions
// against — the only product evidence is the vendor portal dropdown's own
// fixed ordering (PENDING, READY_FOR_SETUP, SETUP_IN_PROGRESS, READY,
// COMPLETED), so this matrix enforces exactly that linear progression: one
// step forward at a time, no skipping, no backward moves.
describe('canTransitionVenueBooking', () => {
  describe('legal transitions — the one step forward each state allows', () => {
    test('PENDING -> READY_FOR_SETUP', () => {
      expect(canTransitionVenueBooking('PENDING', 'READY_FOR_SETUP')).toBe(true);
    });

    test('READY_FOR_SETUP -> SETUP_IN_PROGRESS', () => {
      expect(canTransitionVenueBooking('READY_FOR_SETUP', 'SETUP_IN_PROGRESS')).toBe(true);
    });

    test('SETUP_IN_PROGRESS -> READY', () => {
      expect(canTransitionVenueBooking('SETUP_IN_PROGRESS', 'READY')).toBe(true);
    });

    test('READY -> COMPLETED', () => {
      expect(canTransitionVenueBooking('READY', 'COMPLETED')).toBe(true);
    });
  });

  describe('skipping ahead is rejected', () => {
    test('PENDING cannot jump straight to SETUP_IN_PROGRESS', () => {
      expect(canTransitionVenueBooking('PENDING', 'SETUP_IN_PROGRESS')).toBe(false);
    });

    test('PENDING cannot jump straight to READY', () => {
      expect(canTransitionVenueBooking('PENDING', 'READY')).toBe(false);
    });

    test('PENDING cannot jump straight to COMPLETED', () => {
      expect(canTransitionVenueBooking('PENDING', 'COMPLETED')).toBe(false);
    });

    test('READY_FOR_SETUP cannot jump straight to READY', () => {
      expect(canTransitionVenueBooking('READY_FOR_SETUP', 'READY')).toBe(false);
    });

    test('READY_FOR_SETUP cannot jump straight to COMPLETED', () => {
      expect(canTransitionVenueBooking('READY_FOR_SETUP', 'COMPLETED')).toBe(false);
    });

    test('SETUP_IN_PROGRESS cannot jump straight to COMPLETED', () => {
      expect(canTransitionVenueBooking('SETUP_IN_PROGRESS', 'COMPLETED')).toBe(false);
    });
  });

  describe('backward moves are rejected', () => {
    test('READY_FOR_SETUP -> PENDING is rejected', () => {
      expect(canTransitionVenueBooking('READY_FOR_SETUP', 'PENDING')).toBe(false);
    });

    test('SETUP_IN_PROGRESS -> READY_FOR_SETUP is rejected', () => {
      expect(canTransitionVenueBooking('SETUP_IN_PROGRESS', 'READY_FOR_SETUP')).toBe(false);
    });

    test('READY -> SETUP_IN_PROGRESS is rejected', () => {
      expect(canTransitionVenueBooking('READY', 'SETUP_IN_PROGRESS')).toBe(false);
    });

    test('COMPLETED -> READY is rejected', () => {
      expect(canTransitionVenueBooking('COMPLETED', 'READY')).toBe(false);
    });
  });

  test('COMPLETED is fully terminal — no legal outgoing transitions', () => {
    expect(VENUE_BOOKING_STATUS_TRANSITIONS.COMPLETED).toEqual([]);
  });

  test('a status cannot transition to itself', () => {
    expect(canTransitionVenueBooking('PENDING', 'PENDING')).toBe(false);
    expect(canTransitionVenueBooking('READY', 'READY')).toBe(false);
  });
});
