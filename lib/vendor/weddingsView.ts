// Groups a vendor's VendorBooking rows (from services/venuePortal.service.ts's getDashboard, already scoped
// to the authenticated vendor) into one card per wedding, for the Vendor -> Weddings screen. Pure: no
// database, no framework — same discipline as lib/wedding/controlRoom.ts. Decides nothing new: "needs
// attention" and status wording are derived entirely from fields the dashboard already returns
// (bookingStatus, task dueAt/status), never invented.
import type { venuePortalService } from '@/services/venuePortal.service';

export type VendorBookingRow = Awaited<ReturnType<typeof venuePortalService.getDashboard>>['bookings'][number];

export interface VendorWeddingCard {
  weddingId: string;
  name: string;
  reference: string;
  city: string;
  guestCount: number | null;
  primaryDate: string;
  isPast: boolean;
  overallStatus: 'needs-attention' | 'upcoming' | 'completed';
  nextAction: string | null;
  bookings: {
    id: string;
    function: string;
    date: string;
    startTime: string | null;
    venueName: string | null;
    status: VendorBookingRow['bookingStatus'];
    venueStatus: VendorBookingRow['venueStatus'];
    nextVenueStatus: VendorBookingRow['venueStatus'] | null;
    amount: number;
    service: string | null;
    overdueTasks: { id: string; title: string }[];
  }[];
}

// Exported so lib/vendor/servicesView.ts shares this exact rule instead of redefining it.
export function isOverdue(dueAt: string | null, status: string) {
  return Boolean(dueAt) && status !== 'DONE' && new Date(dueAt as string).getTime() < Date.now();
}

// The single source for the venue setup transition chain — lib/vendor/servicesView.ts imports this too,
// instead of each keeping its own copy. Mirrors lib/wedding/lifecycle.ts's VENUE_BOOKING_STATUS_TRANSITIONS
// exactly (a strictly linear, one-step-forward chain), duplicated rather than imported from there since
// that file also pulls in weddingRepository/activityLogRepository at module scope, which this file (pure,
// no database, no framework — imported by 'use client' components for its types) must not bundle. Keep
// both in sync if the venue setup lifecycle ever changes.
export const NEXT_VENUE_STATUS: Record<VendorBookingRow['venueStatus'], VendorBookingRow['venueStatus'] | null> = {
  PENDING: 'READY_FOR_SETUP',
  READY_FOR_SETUP: 'SETUP_IN_PROGRESS',
  SETUP_IN_PROGRESS: 'READY',
  READY: 'COMPLETED',
  COMPLETED: null,
};

export function buildVendorWeddingsView(bookings: VendorBookingRow[]): VendorWeddingCard[] {
  const byWedding = new Map<string, VendorBookingRow[]>();
  for (const booking of bookings) {
    const list = byWedding.get(booking.event.id) ?? [];
    list.push(booking);
    byWedding.set(booking.event.id, list);
  }

  const now = Date.now();
  const cards: VendorWeddingCard[] = [];

  for (const [weddingId, rows] of byWedding) {
    const first = rows[0];
    const sorted = [...rows].sort((a, b) => new Date(a.event.date).getTime() - new Date(b.event.date).getTime());
    const upcoming = sorted.find((r) => new Date(r.event.date).getTime() >= now);
    const primary = upcoming ?? sorted[sorted.length - 1];

    const bookingRows = sorted.map((r) => ({
      id: r.id,
      function: r.event.function,
      date: r.event.date,
      startTime: r.event.startTime,
      venueName: r.event.venueName,
      status: r.bookingStatus,
      venueStatus: r.venueStatus,
      nextVenueStatus: NEXT_VENUE_STATUS[r.venueStatus],
      amount: r.amount,
      service: r.requirements?.name ?? null,
      overdueTasks: r.tasks.filter((t) => isOverdue(t.dueAt, t.status)).map((t) => ({ id: t.id, title: t.title })),
    }));

    const awaitingResponse = bookingRows.filter((b) => b.status === 'PENDING_VENDOR_CONFIRMATION');
    const withOverdueTasks = bookingRows.filter((b) => b.overdueTasks.length > 0);
    const needsAttention = awaitingResponse.length > 0 || withOverdueTasks.length > 0;

    const allClosed = bookingRows.every((b) => b.status === 'COMPLETED' || b.status === 'CANCELLED');
    const isPast = new Date(primary.event.date).getTime() < now;

    let nextAction: string | null = null;
    if (awaitingResponse.length > 0) nextAction = `Respond to booking request — ${awaitingResponse[0].function}`;
    else if (withOverdueTasks.length > 0) nextAction = `${withOverdueTasks[0].overdueTasks[0].title} is overdue — ${withOverdueTasks[0].function}`;
    else if (!allClosed && upcoming) nextAction = `Next: ${primary.event.function} on ${new Date(primary.event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}`;

    cards.push({
      weddingId,
      name: first.event.name,
      reference: first.event.reference,
      city: first.event.city,
      guestCount: first.event.guestCount,
      primaryDate: primary.event.date,
      isPast,
      overallStatus: needsAttention ? 'needs-attention' : allClosed ? 'completed' : 'upcoming',
      nextAction,
      bookings: bookingRows,
    });
  }

  return cards.sort((a, b) => new Date(a.primaryDate).getTime() - new Date(b.primaryDate).getTime());
}
