import { prisma } from '@/lib/prisma';
import { bookingRepository } from '@/repositories/booking.repository';
import { weddingRepository } from '@/repositories/wedding.repository';
import { weddingEventRepository } from '@/repositories/weddingEvent.repository';
import { vendorBookingRepository } from '@/repositories/vendorBooking.repository';
import { taskRepository } from '@/repositories/task.repository';
import { activityLogRepository } from '@/repositories/activityLog.repository';
import { timelineMilestoneRepository } from '@/repositories/timelineMilestone.repository';
import { leadRepository } from '@/repositories/lead.repository';
import { enquiryRepository } from '@/repositories/enquiry.repository';
import { consultationRepository } from '@/repositories/consultation.repository';
import { DEFAULT_MILESTONE_SEQUENCE } from '@/lib/wedding/timeline';
import { InvalidTransitionError, NotFoundError } from '@/lib/errors';
import type { SourceType } from '@/services/leadInbox.service';
import { Prisma, type Wedding, type Lead, type Enquiry, type Consultation } from '@/generated/prisma/client';

type Tx = Prisma.TransactionClient;
type ConvertibleSubject = Lead | Enquiry | Consultation;

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

// ---------------------------------------------------------------------------
// CRM-path conversion (domain-model.md §5.1): WON only makes a Lead/Enquiry/
// Consultation *eligible* — this function is the explicit "Create Wedding
// Workspace" action that actually creates the Wedding. Deliberately simpler
// than convertBookingToWedding: there's no BookingItem[] to walk, so no
// VendorBooking/Task-per-item loop — the coordinator adds vendor bookings
// from inside the new Workspace instead.
// ---------------------------------------------------------------------------

async function findConvertibleSubject(sourceType: SourceType, id: string): Promise<ConvertibleSubject | null> {
  if (sourceType === 'LEAD') return leadRepository.findById(id);
  if (sourceType === 'ENQUIRY') return enquiryRepository.findById(id);
  return consultationRepository.findById(id);
}

// The one place that maps {sourceType, id} to Wedding's four mutually-exclusive
// source FKs (schema comment: "Exactly one of these four is set, matching
// WeddingSource") — reused by both the eligibility/idempotency check here and
// services/leadWorkspace.service.ts's post-conversion lock guard.
export async function findWeddingForSource(
  sourceType: SourceType,
  id: string,
  tx: Tx | typeof prisma = prisma
): Promise<Wedding | null> {
  if (sourceType === 'LEAD') return weddingRepository.findBySourceLeadId(id, tx);
  if (sourceType === 'ENQUIRY') return weddingRepository.findBySourceEnquiryId(id, tx);
  return weddingRepository.findBySourceConsultationId(id, tx);
}

function subjectName(sourceType: SourceType, subject: ConvertibleSubject): string {
  if (sourceType === 'LEAD') return (subject as Lead).phone;
  return (subject as Enquiry | Consultation).name;
}

// Best-effort carryover from whichever capture table this is — same field
// mapping leadWorkspace.service.ts's toWeddingDetails() already established,
// not re-derived here. Lead has none of these fields; Enquiry/Consultation do.
function carryOverWeddingFields(sourceType: SourceType, subject: ConvertibleSubject) {
  if (sourceType === 'CONSULTATION') {
    const c = subject as Consultation;
    return { guestCount: c.guestCount, weddingType: c.eventType, totalBudget: c.totalBudget ?? undefined };
  }
  if (sourceType === 'ENQUIRY') {
    const e = subject as Enquiry;
    const guestCount = e.guestCount ? Number(e.guestCount) : NaN;
    return { guestCount: Number.isFinite(guestCount) ? guestCount : undefined, weddingType: e.eventType, totalBudget: undefined };
  }
  return { guestCount: undefined, weddingType: undefined, totalBudget: undefined };
}

export interface ConvertSourceInput {
  weddingDate: Date;
  // Required at this boundary rather than silently defaulted — Lead has no
  // city field at all, and Consultation.city is nullable, so there's no safe
  // fallback; the dialog pre-fills from the subject's own city when one
  // exists (services/leadWorkspace.service.ts's toCustomer()) but always
  // submits a value.
  city: string;
  venueName?: string;
  coordinatorId?: string;
  notes?: string;
  tokenAdvanceReceived: boolean;
}

export async function convertLeadToWedding(
  sourceType: SourceType,
  id: string,
  input: ConvertSourceInput,
  actorId: string | null
): Promise<Wedding> {
  const subject = await findConvertibleSubject(sourceType, id);
  if (!subject) {
    throw new NotFoundError(sourceType, id);
  }
  if (subject.pipelineStage !== 'WON') {
    throw new InvalidTransitionError(
      `Cannot create a Wedding Workspace — ${sourceType.toLowerCase()} is not Booked (current stage: ${subject.pipelineStage})`
    );
  }

  // Idempotent, same discipline as convertBookingToWedding — a retried
  // request against an already-converted subject returns the existing
  // Wedding rather than erroring or duplicating.
  const existing = await findWeddingForSource(sourceType, id);
  if (existing) {
    return existing;
  }

  const carryOver = carryOverWeddingFields(sourceType, subject);
  const sourceLink =
    sourceType === 'LEAD'
      ? { sourceLead: { connect: { id } } }
      : sourceType === 'ENQUIRY'
        ? { sourceEnquiry: { connect: { id } } }
        : { sourceConsultation: { connect: { id } } };

  return prisma.$transaction(async (tx) => {
    const weddingNumber = await generateWeddingNumber(tx);

    const wedding = await weddingRepository.create(
      {
        weddingNumber,
        status: 'PLANNING',
        source: 'CRM',
        primaryDate: input.weddingDate,
        city: input.city,
        guestCount: carryOver.guestCount,
        weddingType: carryOver.weddingType,
        totalBudget: carryOver.totalBudget,
        coordinator: input.coordinatorId ? { connect: { id: input.coordinatorId } } : undefined,
        ...sourceLink,
      },
      tx
    );

    const weddingEvent = await weddingEventRepository.create(
      {
        wedding: { connect: { id: wedding.id } },
        type: 'WEDDING',
        date: input.weddingDate,
        venueName: input.venueName,
        city: input.city,
      },
      tx
    );

    await activityLogRepository.create(
      {
        type: 'STATUS_CHANGED',
        summary: `Wedding ${weddingNumber} created from ${subjectName(sourceType, subject)}'s ${sourceType.toLowerCase()}`,
        detail:
          [
            input.notes,
            input.tokenAdvanceReceived ? 'Token advance received.' : 'Token advance not yet received.',
          ]
            .filter(Boolean)
            .join(' ') || null,
        wedding: { connect: { id: wedding.id } },
        performedBy: actorId ? { connect: { id: actorId } } : undefined,
      },
      tx
    );

    // On the source record's own timeline too, so Sales sees exactly where
    // the handoff happened without leaving the (now read-only) Lead Workspace.
    await activityLogRepository.create(
      {
        type: 'STATUS_CHANGED',
        summary: `Converted to Wedding ${weddingNumber}`,
        performedBy: actorId ? { connect: { id: actorId } } : undefined,
        ...(sourceType === 'LEAD'
          ? { lead: { connect: { id } } }
          : sourceType === 'ENQUIRY'
            ? { enquiry: { connect: { id } } }
            : { consultation: { connect: { id } } }),
      },
      tx
    );

    await seedDefaultWeddingContent(wedding, weddingEvent.id, input.coordinatorId, tx);

    return wedding;
  });
}

// Phase 6.4 — a coordinator should never land on an empty Workspace. Seeds
// real, already-designed content (docs/wedding-os/03-wedding-workspace.md §3's
// own default sequence, not an invented one), not placeholder rows. "Lead Won"
// starts DONE since that's literally the event that just happened; everything
// else starts PENDING and stays freely editable from here.
//
// Not (yet) applied to convertBookingToWedding — that path isn't wired to a
// live route yet either, and wasn't in scope for this pass; whoever wires it
// up should decide then whether to call this too.
async function seedDefaultWeddingContent(
  wedding: Wedding,
  weddingEventId: string,
  coordinatorId: string | undefined,
  tx: Tx
): Promise<void> {
  await timelineMilestoneRepository.createMany(
    DEFAULT_MILESTONE_SEQUENCE.map((label, index) => ({
      weddingId: wedding.id,
      label,
      sortOrder: index + 1,
      status: label === 'Lead Won' ? 'DONE' : 'PENDING',
    })),
    tx
  );

  await taskRepository.create(
    {
      context: 'WEDDING_TASK',
      title: 'Confirm venue & vendor bookings',
      priority: 'HIGH',
      wedding: { connect: { id: wedding.id } },
      weddingEvent: { connect: { id: weddingEventId } },
      assignedTo: coordinatorId ? { connect: { id: coordinatorId } } : undefined,
    },
    tx
  );
}
