import { prisma } from '@/lib/prisma';
import { bookingRepository } from '@/repositories/booking.repository';
import { weddingRepository } from '@/repositories/wedding.repository';
import { weddingEventRepository } from '@/repositories/weddingEvent.repository';
import { vendorBookingRepository } from '@/repositories/vendorBooking.repository';
import { taskRepository } from '@/repositories/task.repository';
import { activityLogRepository } from '@/repositories/activityLog.repository';
import { Prisma, type Wedding } from '@/generated/prisma/client';

type Tx = Prisma.TransactionClient;

export class InvalidBookingStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBookingStateError';
  }
}

// Track B (2026-07-19): prepares the Booking -> Wedding conversion pipeline
// ahead of Milestone 3/4 landing — NOT wired to any live route yet, and does
// not change current (Mongo-backed) production behavior. This is the exact
// pipeline named as "the first Wedding OS implementation":
//   Booking(CONFIRMED) -> Wedding -> WeddingEvent -> VendorBooking -> Tasks -> ActivityLog
//
// Deliberately stops there — Invoice/Payment creation is NOT included in this
// pass, matching the scoped pipeline as specified. Whether/when an Invoice
// gets auto-created on conversion is still the open question flagged in
// docs/wedding-os/schema-draft-1-notes.md, not resolved here.
export async function convertBookingToWedding(bookingId: string): Promise<Wedding> {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking) {
    throw new InvalidBookingStateError(`Booking not found: ${bookingId}`);
  }
  if (booking.status !== 'CONFIRMED') {
    throw new InvalidBookingStateError(
      `Booking ${bookingId} is not CONFIRMED (status: ${booking.status}) — conversion only runs on confirmed bookings`
    );
  }
  if (!booking.weddingDate) {
    // Historical booking predating the checkout weddingDate field (see
    // prisma/schema.prisma's Booking.weddingDate comment) — the resolved
    // decision was that a date is required for conversion, collected at
    // checkout for new bookings. A pre-existing booking without one can't be
    // converted until a coordinator backfills it — not a silent default.
    throw new InvalidBookingStateError(
      `Booking ${bookingId} has no weddingDate — cannot convert until one is set`
    );
  }

  // Idempotent — a Booking should never spawn two Weddings. Re-running this
  // (e.g. a retried request) against an already-converted booking returns the
  // existing Wedding rather than erroring or duplicating.
  const existing = await weddingRepository.findBySourceBookingId(bookingId);
  if (existing) {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const weddingNumber = await generateWeddingNumber(tx);

    const wedding = await weddingRepository.create(
      {
        weddingNumber,
        status: 'PLANNING',
        source: 'BOOKING',
        primaryDate: booking.weddingDate!,
        city: booking.city,
        guestCount: booking.guestCount,
        weddingType: booking.weddingType,
        totalBudget: booking.total,
        sourceBooking: { connect: { id: booking.id } },
      },
      tx
    );

    const weddingEvent = await weddingEventRepository.create(
      {
        wedding: { connect: { id: wedding.id } },
        type: 'WEDDING',
        date: booking.weddingDate!,
        city: booking.city,
      },
      tx
    );

    await activityLogRepository.create(
      {
        type: 'STATUS_CHANGED',
        summary: `Wedding ${weddingNumber} created from confirmed booking`,
        wedding: { connect: { id: wedding.id } },
      },
      tx
    );

    for (const item of booking.items) {
      if (!item.vendorId) {
        // Resolved in docs/wedding-os/step4-workflow-review.md: BookingItem.vendorId
        // can be null (vendor removed since — e.g. the "Touch Of Cozy" case),
        // but VendorBooking.vendorId is required by design. Skip, log, and
        // flag for manual resolution rather than silently dropping the item
        // or loosening VendorBooking's constraint.
        await activityLogRepository.create(
          {
            type: 'STATUS_CHANGED',
            summary: `Skipped converting "${item.packageName}" (${item.vendorName}) — vendor no longer exists`,
            wedding: { connect: { id: wedding.id } },
          },
          tx
        );
        await taskRepository.create(
          {
            context: 'WEDDING_TASK',
            title: `Assign replacement vendor for "${item.packageName}"`,
            description: `Original vendor "${item.vendorName}" (${item.vendorCategory}) no longer exists. Original price: ${item.price}.`,
            priority: 'HIGH',
            wedding: { connect: { id: wedding.id } },
            weddingEvent: { connect: { id: weddingEvent.id } },
          },
          tx
        );
        continue;
      }

      const vendorBooking = await vendorBookingRepository.create(
        {
          weddingEvent: { connect: { id: weddingEvent.id } },
          vendor: { connect: { id: item.vendorId } },
          agreedPrice: item.price,
          status: 'PENDING_VENDOR_CONFIRMATION',
        },
        tx
      );

      await taskRepository.create(
        {
          context: 'WEDDING_TASK',
          title: `Confirm booking with ${item.vendorName} for "${item.packageName}"`,
          priority: 'MEDIUM',
          wedding: { connect: { id: wedding.id } },
          weddingEvent: { connect: { id: weddingEvent.id } },
          vendorBooking: { connect: { id: vendorBooking.id } },
        },
        tx
      );

      await activityLogRepository.create(
        {
          type: 'STATUS_CHANGED',
          summary: `Vendor booking created: ${item.vendorName} for "${item.packageName}", pending confirmation`,
          wedding: { connect: { id: wedding.id } },
          vendorBooking: { connect: { id: vendorBooking.id } },
        },
        tx
      );
    }

    return wedding;
  });
}

// WED-YYYY-NNNN, sequential within year — same pattern already established
// for Invoice.invoiceNumber (INV-YYYYMM-NNNN) in the live Mongo-era API route,
// for consistency rather than inventing a new numbering scheme.
async function generateWeddingNumber(tx: Tx): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.wedding.count({
    where: { weddingNumber: { startsWith: `WED-${year}-` } },
  });
  const sequence = String(count + 1).padStart(4, '0');
  return `WED-${year}-${sequence}`;
}
