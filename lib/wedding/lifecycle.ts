import type { Prisma } from '@/generated/prisma/client';
import type { WeddingStatus, VendorBookingStatus, VenueBookingStatus } from '@/generated/prisma/enums';
import { weddingRepository } from '@/repositories/wedding.repository';
import { activityLogRepository } from '@/repositories/activityLog.repository';

type Tx = Prisma.TransactionClient;

// domain-model.md §5.2 — PLANNING->ACTIVE is deliberately NOT in this matrix:
// it fires automatically (see maybeActivateWedding below), not via a
// coordinator-picked transition, so there's nothing to manually select it
// with. Everything else here is an explicit coordinator action.
//
// POSTPONED resumes to either PLANNING or ACTIVE (coordinator picks) rather
// than tracking a single "paused from" state — same precedent as ON_HOLD in
// lib/crm/pipeline.ts, since postponement is about the date/plans slipping,
// not about undoing whatever vendor-confirmation progress already happened.
export const WEDDING_STATUS_TRANSITIONS: Record<WeddingStatus, WeddingStatus[]> = {
  PLANNING: ['POSTPONED', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'POSTPONED', 'CANCELLED'],
  POSTPONED: ['PLANNING', 'ACTIVE'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionWedding(from: WeddingStatus, to: WeddingStatus): boolean {
  return WEDDING_STATUS_TRANSITIONS[from].includes(to);
}

// domain-model.md §5.2 — the one automatic transition. Called after any
// VendorBooking on this Wedding reaches CONFIRMED (services/weddingWorkspace
// .service.ts's updateVendorBookingStatus). A no-op unless the Wedding is
// still PLANNING, so it's safe to call unconditionally on every confirmation,
// not just the first.
export async function maybeActivateWedding(weddingId: string, tx: Tx): Promise<void> {
  const wedding = await weddingRepository.findById(weddingId, tx);
  if (!wedding || wedding.status !== 'PLANNING') return;

  await weddingRepository.update(weddingId, { status: 'ACTIVE' }, tx);
  await activityLogRepository.create(
    {
      type: 'STATUS_CHANGED',
      summary: 'Wedding became Active — first vendor booking confirmed',
      wedding: { connect: { id: weddingId } },
    },
    tx
  );
}

// Production-integrity fix — only the 3 transitions currently exercised by
// the real product workflow (components/wedding/workspace/WeddingEvents.tsx's
// Confirm/Decline/Mark Completed buttons; verified against every actual
// VendorBooking status write in the codebase before adding this) are
// authorized here. DECLINED/CANCELLED/COMPLETED/CUSTOMER_APPROVAL_PENDING are
// deliberately terminal in this matrix — not because the business will never
// need e.g. a decline-retry or cancel flow, but because those are
// undesigned future product decisions: CANCELLED has no UI trigger anywhere
// today, and CUSTOMER_APPROVAL_PENDING's entire feature is an explicitly
// undecided founder question (docs/wedding-os/05-customer-portal.md §3,
// "flag for the founder rather than assume"). Widen this matrix only once
// that workflow is deliberately designed, not preemptively.
export const VENDOR_BOOKING_STATUS_TRANSITIONS: Record<VendorBookingStatus, VendorBookingStatus[]> = {
  PENDING_VENDOR_CONFIRMATION: ['CONFIRMED', 'DECLINED'],
  CONFIRMED: ['COMPLETED'],
  DECLINED: [],
  CUSTOMER_APPROVAL_PENDING: [],
  CANCELLED: [],
  COMPLETED: [],
};

export function canTransitionVendorBooking(from: VendorBookingStatus, to: VendorBookingStatus): boolean {
  return VENDOR_BOOKING_STATUS_TRANSITIONS[from].includes(to);
}

// venueStatus is a separate field from VendorBooking.status above — a
// vendor-portal-only physical-setup checklist (services/venuePortal.service
// .ts, components/VenuePortalClient.tsx) with no other reader or writer
// anywhere in the codebase (no payout gating, no coordinator/admin/customer
// visibility). Unlike VENDOR_BOOKING_STATUS_TRANSITIONS above, there's no
// per-action UI (no distinct Confirm/Decline/Mark Completed-style buttons)
// and no design doc to verify specific transitions against — the only
// concrete product evidence is the dropdown's own fixed, consistently-used
// ordering (VenuePortalClient.tsx's `statuses` array), which encodes a
// linear physical-setup progression. So this matrix enforces exactly that
// ordering — one step forward at a time, no skipping, no backward moves —
// and nothing more speculative (e.g. gating on VendorBooking.status, or
// allowing corrective backward moves) since neither is evidenced by any
// current product behavior.
export const VENUE_BOOKING_STATUS_TRANSITIONS: Record<VenueBookingStatus, VenueBookingStatus[]> = {
  PENDING: ['READY_FOR_SETUP'],
  READY_FOR_SETUP: ['SETUP_IN_PROGRESS'],
  SETUP_IN_PROGRESS: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
};

export function canTransitionVenueBooking(from: VenueBookingStatus, to: VenueBookingStatus): boolean {
  return VENUE_BOOKING_STATUS_TRANSITIONS[from].includes(to);
}
