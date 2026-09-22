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
const { canTransitionVendorBooking, VENDOR_BOOKING_STATUS_TRANSITIONS, canTransitionVenueBooking, VENUE_BOOKING_STATUS_TRANSITIONS, canTransitionWedding, WEDDING_STATUS_TRANSITIONS } =
  await import('./lifecycle');

// Exhaustively covers the vendor-booking transition matrix: the vendor's own answer (confirm / decline / completed) and the wedding team's
// cancel (allowed until the work is finished — also from a decline, so the service can go to someone else). CUSTOMER_APPROVAL_PENDING
// stays undesigned and unreachable.
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

    test('a vendor can be cancelled until the work is finished — pending, confirmed or declined', () => {
      expect(canTransitionVendorBooking('PENDING_VENDOR_CONFIRMATION', 'CANCELLED')).toBe(true);
      expect(canTransitionVendorBooking('CONFIRMED', 'CANCELLED')).toBe(true);
      expect(canTransitionVendorBooking('DECLINED', 'CANCELLED')).toBe(true);
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

    test('CANCELLED -> COMPLETED is rejected (cancelled is final)', () => {
      expect(canTransitionVendorBooking('CANCELLED', 'COMPLETED')).toBe(false);
    });

    test('CUSTOMER_APPROVAL_PENDING -> COMPLETED is rejected (undesigned feature)', () => {
      expect(canTransitionVendorBooking('CUSTOMER_APPROVAL_PENDING', 'COMPLETED')).toBe(false);
    });
  });

  describe('every other state is fully terminal in this matrix', () => {
    test('DECLINED can only be cancelled (so the service can go to someone else)', () => {
      expect(VENDOR_BOOKING_STATUS_TRANSITIONS.DECLINED).toEqual(['CANCELLED']);
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

  test('a completed booking cannot be cancelled — the work happened', () => {
    expect(canTransitionVendorBooking('COMPLETED', 'CANCELLED')).toBe(false);
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

// The whole wedding matrix, written out so any accidental broadening shows up as a failing test. The one change in the V1
// restructuring is PLANNING -> COMPLETED (a wedding no vendor ever confirmed must still be completable); the not-before-the-last-day
// rule for it is enforced in weddingWorkspaceService.transitionStatus (see weddingWorkspace.service.test.ts).
describe('canTransitionWedding', () => {
  test('the full matrix is exactly this', () => {
    expect(WEDDING_STATUS_TRANSITIONS).toEqual({
      PLANNING: ['COMPLETED', 'POSTPONED', 'CANCELLED'],
      ACTIVE: ['COMPLETED', 'POSTPONED', 'CANCELLED'],
      POSTPONED: ['PLANNING', 'ACTIVE'],
      COMPLETED: [],
      CANCELLED: [],
    });
  });

  test('PLANNING -> COMPLETED is allowed (vendorless / venue-only weddings)', () => {
    expect(canTransitionWedding('PLANNING', 'COMPLETED')).toBe(true);
  });

  test('existing ACTIVE transitions are unchanged', () => {
    expect(canTransitionWedding('ACTIVE', 'COMPLETED')).toBe(true);
    expect(canTransitionWedding('ACTIVE', 'POSTPONED')).toBe(true);
    expect(canTransitionWedding('ACTIVE', 'CANCELLED')).toBe(true);
    expect(canTransitionWedding('ACTIVE', 'PLANNING')).toBe(false);
  });

  test('PLANNING -> ACTIVE is still not a manual move (it only ever happens automatically)', () => {
    expect(canTransitionWedding('PLANNING', 'ACTIVE')).toBe(false);
  });

  test('POSTPONED still resumes only to PLANNING or ACTIVE — it cannot jump straight to COMPLETED', () => {
    expect(canTransitionWedding('POSTPONED', 'PLANNING')).toBe(true);
    expect(canTransitionWedding('POSTPONED', 'ACTIVE')).toBe(true);
    expect(canTransitionWedding('POSTPONED', 'COMPLETED')).toBe(false);
    expect(canTransitionWedding('POSTPONED', 'CANCELLED')).toBe(false);
  });

  test('COMPLETED and CANCELLED remain terminal', () => {
    for (const to of ['PLANNING', 'ACTIVE', 'POSTPONED', 'COMPLETED', 'CANCELLED'] as const) {
      expect(canTransitionWedding('COMPLETED', to)).toBe(false);
      expect(canTransitionWedding('CANCELLED', to)).toBe(false);
    }
  });
});
