// Groups a vendor's Payout rows (from services/venuePortal.service.ts's getDashboard, already
// vendor-scoped) into paid/pending buckets, plus a derived "awaiting calculation" bucket for
// COMPLETED bookings with no Payout row yet. Pure: no database, no framework — same discipline as
// weddingsView.ts/servicesView.ts/todayView.ts.
//
// docs/wedding-os/11-vivah-os-ux-architecture.md §14 found that a Payout row only exists once an
// admin manually runs services/payout.service.ts's calculatePayoutForBooking — most COMPLETED
// bookings have none yet. "Awaiting calculation" isn't fabricated status: bookingStatus and the
// absence of a matching Payout are both real, already-fetched facts, not an invented state.
import type { VendorBookingRow } from './weddingsView';
import type { venuePortalService } from '@/services/venuePortal.service';

export type VendorPayoutRow = Awaited<ReturnType<typeof venuePortalService.getDashboard>>['payouts'][number];

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// IST-pinned, same convention as the rest of Vendor OS (lib/wedding/controlRoom.ts,
// lib/vendor/todayView.ts) — a payout date is a calendar day, not an instant.
function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export interface VendorPaymentCard {
  id: string;
  weddingName: string;
  weddingReference: string;
  function: string;
  eventDate: string;
  grossAmountLabel: string;
  commissionLabel: string;
  netAmountLabel: string;
  status: VendorPayoutRow['status'];
  paidOnLabel: string | null;
}

export interface VendorAwaitingCard {
  bookingId: string;
  weddingName: string;
  weddingReference: string;
  function: string;
  eventDate: string;
  agreedAmountLabel: string;
}

export interface VendorPaymentsView {
  summary: { totalReceivedLabel: string; totalPendingLabel: string; awaitingCount: number };
  paid: VendorPaymentCard[];
  pending: VendorPaymentCard[];
  awaitingCalculation: VendorAwaitingCard[];
}

function paymentCard(payout: VendorPayoutRow): VendorPaymentCard {
  return {
    id: payout.id,
    weddingName: payout.weddingName,
    weddingReference: payout.weddingReference,
    function: payout.function,
    eventDate: dateLabel(payout.eventDate),
    grossAmountLabel: inr(payout.grossAmount),
    commissionLabel: `${inr(payout.commissionAmount)} (${payout.commissionRate}%)`,
    netAmountLabel: inr(payout.netAmount),
    status: payout.status,
    paidOnLabel: payout.paidAt ? dateLabel(payout.paidAt) : null,
  };
}

export function buildVendorPaymentsView(bookings: VendorBookingRow[], payouts: VendorPayoutRow[]): VendorPaymentsView {
  const paidPayouts = payouts.filter((p) => p.status === 'PAID');
  const pendingPayouts = payouts.filter((p) => p.status !== 'PAID');

  const totalReceived = paidPayouts.reduce((sum, p) => sum + p.netAmount, 0);
  const totalPending = pendingPayouts.reduce((sum, p) => sum + p.netAmount, 0);

  const payoutBookingIds = new Set(payouts.map((p) => p.bookingId));
  const awaitingCalculation = bookings
    .filter((b) => b.bookingStatus === 'COMPLETED' && !payoutBookingIds.has(b.id))
    .map((b) => ({
      bookingId: b.id,
      weddingName: b.event.name,
      weddingReference: b.event.reference,
      function: b.event.function,
      eventDate: dateLabel(b.event.date),
      agreedAmountLabel: inr(b.amount),
    }));

  return {
    summary: {
      totalReceivedLabel: inr(totalReceived),
      totalPendingLabel: inr(totalPending),
      awaitingCount: awaitingCalculation.length,
    },
    paid: paidPayouts.map(paymentCard),
    pending: pendingPayouts.map(paymentCard),
    awaitingCalculation,
  };
}
