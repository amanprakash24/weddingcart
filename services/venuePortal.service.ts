import { auditAs } from '@/lib/finance/audit';
import { prisma } from '@/lib/prisma';
import { NotFoundError, InvalidTransitionError, ValidationError } from '@/lib/errors';
import { VenueBookingStatus, AvailabilityStatus } from '@/generated/prisma/enums';
import { canTransitionVenueBooking } from '@/lib/wedding/lifecycle';
import { checkBookingResponse } from '@/lib/vendor/bookingResponse';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { vendorPaymentService } from '@/services/vendorPayment.service';

// A vendor can set at most this many dates in one request — generous enough for
// "block the next 3 months" in one go, small enough to keep the transaction bounded.
const MAX_AVAILABILITY_DATES_PER_REQUEST = 90;

export interface AvailabilityEntry {
  date: string; // 'YYYY-MM-DD'
  status: AvailabilityStatus | null; // null clears the override back to the default (unset = available)
  note?: string;
}

export async function vendorForUser(userId: string) {
  const profile = await prisma.vendorProfile.findUnique({
    where: { userId },
    select: { vendorId: true, vendor: { select: { id: true, name: true, city: true, address: true, category: { select: { name: true } } } } },
  });
  if (!profile) throw new NotFoundError('Vendor profile', userId);
  return profile;
}

// The vendor these screens are about: the one the person is WORKING in (lib/auth/workingVendor.ts), by id — never from the request.
async function vendorById(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, name: true, city: true, address: true, category: { select: { name: true } } } });
  if (!vendor) throw new NotFoundError('Vendor', vendorId);
  return vendor;
}

// `amount` is the vendor's OWN payable amount (lib/vendor/vendorMoney.ts `payable`) — never the couple's price (agreedPrice) or our
// commission (money design rule 1, 25 Nov 2026). null for a member without view_financials, left out here on the server.
function bookingView(payable: number | null, booking: {
  id: string; status: string; venueStatus: VenueBookingStatus; agreedPrice: number; respondedAt: Date | null; vendorDoneAt: Date | null;
  weddingEvent: { id: string; type: string; label: string | null; date: Date; startTime: string | null; venueName: string | null; venueAddress: string | null; city: string; wedding: { id: string; weddingNumber: string; weddingType: string | null; guestCount: number | null; customer: { name: string | null } | null; events: { id: string; type: string; label: string | null; date: Date; startTime: string | null; venueName: string | null; city: string }[] } };
  vendorPackage: { name: string; description: string } | null;
  tasks: { id: string; title: string; status: string; dueAt: Date | null }[];
}) {
  return {
    id: booking.id,
    bookingStatus: booking.status,
    venueStatus: booking.venueStatus,
    amount: payable,
    // Already fetched (no `select` narrows this query, so every VendorBooking scalar column is returned by
    // default) — just wasn't exposed until the Vendor -> Today screen needed a real "recent activity" source.
    respondedAt: booking.respondedAt?.toISOString() ?? null,
    vendorDone: booking.vendorDoneAt !== null, // the vendor said the work is done (PR 6)
    event: {
      id: booking.weddingEvent.wedding.id,
      name: booking.weddingEvent.wedding.customer?.name || booking.weddingEvent.wedding.weddingNumber,
      reference: booking.weddingEvent.wedding.weddingNumber,
      type: booking.weddingEvent.wedding.weddingType || 'Event',
      guestCount: booking.weddingEvent.wedding.guestCount,
      function: booking.weddingEvent.label || booking.weddingEvent.type,
      date: booking.weddingEvent.date.toISOString(),
      startTime: booking.weddingEvent.startTime,
      venueName: booking.weddingEvent.venueName,
      venueAddress: booking.weddingEvent.venueAddress,
      city: booking.weddingEvent.city,
      functions: booking.weddingEvent.wedding.events.map((event) => ({ id: event.id, name: event.label || event.type, date: event.date.toISOString(), startTime: event.startTime, venueName: event.venueName, city: event.city })),
    },
    requirements: booking.vendorPackage ? { name: booking.vendorPackage.name, description: booking.vendorPackage.description } : null,
    tasks: booking.tasks.map((task) => ({ ...task, dueAt: task.dueAt?.toISOString() ?? null })),
  };
}

const bookingInclude = {
  weddingEvent: {
    include: {
      wedding: {
        select: {
          id: true, weddingNumber: true, weddingType: true, guestCount: true,
          customer: { select: { name: true } },
          events: { orderBy: { date: 'asc' as const }, select: { id: true, type: true, label: true, date: true, startTime: true, venueName: true, city: true } },
        },
      },
    },
  },
  vendorPackage: { select: { name: true, description: true } },
  tasks: { select: { id: true, title: true, status: true, dueAt: true }, orderBy: { dueAt: 'asc' as const } },
} as const;

export const venuePortalService = {
  // What Shaadi Shopping shares with one vendor. Money (money design rule 1, 25 Nov 2026): each work's OWN payable amount, for members
  // with view_financials only — never the couple's price, commission, approval amounts (the couple's), payouts' commission, or a
  // document filed as QUOTATION (it can be the couple's quotation).
  async getDashboard(vendorId: string, { seesMoney }: { seesMoney: boolean }) {
    const profile = { vendorId, vendor: await vendorById(vendorId) };
    const bookings = await prisma.vendorBooking.findMany({ where: { vendorId: profile.vendorId }, include: bookingInclude, orderBy: { weddingEvent: { date: 'asc' } } });
    const bookingIds = bookings.map((booking) => booking.id);
    const documents = bookingIds.length ? await prisma.document.findMany({ where: { vendorBookingId: { in: bookingIds }, category: { in: ['VENUE_AGREEMENT', 'FLOOR_PLAN', 'MENU'] }, visibility: 'CUSTOMER_VISIBLE' }, select: { id: true, fileName: true, url: true, category: true, vendorBookingId: true, createdAt: true }, orderBy: { createdAt: 'desc' } }) : [];
    const eventIds = bookings.map((booking) => booking.weddingEventId);
    const packageIds = bookings.map((booking) => booking.vendorPackageId).filter((id): id is string => Boolean(id));
    const approvals = eventIds.length ? await prisma.approvalRequest.findMany({
      where: { weddingEventId: { in: eventIds }, subjectId: { in: [...bookingIds, ...packageIds] } },
      select: { id: true, subjectType: true, title: true, status: true, amount: true, weddingEventId: true },
      orderBy: { createdAt: 'desc' },
    }) : [];
    const availability = await prisma.vendorAvailability.findMany({ where: { vendorId: profile.vendorId, date: { gte: new Date() } }, select: { date: true, status: true, note: true }, orderBy: { date: 'asc' }, take: 90 });
    const payable = seesMoney ? new Map((await vendorPaymentService.forVendor(profile.vendorId)).works.map((w) => [w.id, w.payable] as const)) : null;
    return {
      vendor: profile.vendor,
      bookings: bookings.map((booking) => bookingView(payable?.get(booking.id) ?? null, booking)),
      documents: documents.map((document) => ({ ...document, createdAt: document.createdAt.toISOString() })),
      availability: availability.map((item) => ({ ...item, date: item.date.toISOString() })),
      approvals: approvals.map((approval) => ({ ...approval, amount: null, title: approval.title || 'Client approval', weddingEventId: approval.weddingEventId })),
    };
  },

  async updateStatus(vendorId: string, bookingId: string, venueStatus: VenueBookingStatus) {
    const booking = await prisma.vendorBooking.findFirst({ where: { id: bookingId, vendorId } });
    if (!booking) throw new NotFoundError('Venue booking', bookingId);

    if (!canTransitionVenueBooking(booking.venueStatus, venueStatus)) {
      throw new InvalidTransitionError(`Cannot move venue status from ${booking.venueStatus} to ${venueStatus}`);
    }

    // Only what the vendor's screen needs back — never the whole row, which carries the couple's price (agreedPrice; 25 Nov 2026).
    return prisma.vendorBooking.update({ where: { id: bookingId }, data: { venueStatus }, select: { id: true, status: true, venueStatus: true } });
  },

  // The vendor answers Shaadi Shopping's booking request (12 Oct 2026, lib/vendor/bookingResponse.ts): Confirm, or Can't do it
  // with a reason. Only a booking of the vendor the person is working in (`who`, lib/auth/workingVendor.ts — the owner or anyone
  // in the business who may manage its weddings), and only while it still waits. It goes through the same change staff make
  // (weddingWorkspaceService.updateVendorBookingStatus): the confirm task closes, the wedding may become active, and the
  // timeline says the vendor answered, naming the person who did.
  async respond({ vendorId, userId }: { vendorId: string; userId: string }, bookingId: string, input: { answer?: unknown; reason?: unknown }) {
    const booking = await prisma.vendorBooking.findFirst({ where: { id: bookingId, vendorId }, select: { id: true, status: true, weddingEvent: { select: { weddingId: true } } } });
    if (!booking) throw new NotFoundError('Booking', bookingId);
    if (booking.status !== 'PENDING_VENDOR_CONFIRMATION') throw new InvalidTransitionError('This booking has already been answered — reload to see where it stands');
    const checked = checkBookingResponse(input);
    if (!checked.ok) throw new ValidationError(checked.error);
    const updated = await weddingWorkspaceService.updateVendorBookingStatus(booking.weddingEvent.weddingId, booking.id, checked.status, checked.reason ?? undefined, undefined, { actorId: userId, vendorOs: true });
    return { id: updated.id, status: updated.status, declineReason: updated.declineReason };
  },

  // The vendor says the work is done (money design v1, PR 6). Only on confirmed work of the vendor the person works in; staff then
  // verify it ("Mark completed"). Saying it twice changes nothing.
  async markDone({ vendorId, userId }: { vendorId: string; userId: string }, bookingId: string, note: unknown) {
    const text = typeof note === 'string' ? note.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
    return prisma.$transaction(async (tx) => {
      await auditAs(tx, userId, 'vendor: work done');
      const booking = await tx.vendorBooking.findFirst({ where: { id: bookingId, vendorId }, select: { id: true, status: true, vendorDoneAt: true, weddingEvent: { select: { weddingId: true, label: true, type: true } } } });
      if (!booking) throw new NotFoundError('Booking', bookingId);
      if (booking.status !== 'CONFIRMED') throw new InvalidTransitionError(booking.status === 'COMPLETED' ? 'This work is already completed' : 'Only confirmed work can be marked done');
      if (booking.vendorDoneAt) return { id: booking.id, vendorDoneAt: booking.vendorDoneAt.toISOString() };
      const updated = await tx.vendorBooking.update({ where: { id: booking.id }, data: { vendorDoneAt: new Date(), vendorDoneNote: text || null }, select: { id: true, vendorDoneAt: true } });
      await tx.activityLog.create({ data: { type: 'NOTE', summary: `The vendor says the work for ${booking.weddingEvent.label || booking.weddingEvent.type} is done${text ? `: ${text}` : ''} — check it and mark it completed`, wedding: { connect: { id: booking.weddingEvent.weddingId } }, vendorBooking: { connect: { id: booking.id } }, performedBy: { connect: { id: userId } } } });
      return { id: updated.id, vendorDoneAt: updated.vendorDoneAt!.toISOString() };
    });
  },

  // Self-service availability: a vendor sets AVAILABLE/TENTATIVE/BOOKED/BLOCKED on
  // their own dates (all four values, since nothing in the app derives BOOKED
  // automatically today — restricting it would make that status permanently
  // unreachable). status: null removes the override entirely (back to the
  // implicit default of "no row = available").
  async setAvailability(userId: string, entries: AvailabilityEntry[]) {
    const profile = await vendorForUser(userId);
    if (entries.length === 0) throw new ValidationError('At least one date is required');
    if (entries.length > MAX_AVAILABILITY_DATES_PER_REQUEST) {
      throw new ValidationError(`Cannot set more than ${MAX_AVAILABILITY_DATES_PER_REQUEST} dates in one request`);
    }

    // UTC-anchored, matching the `T00:00:00.000Z` parse below — a local-time
    // midnight would drift by the server's UTC offset and reject/allow the
    // wrong boundary date.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const parsed = entries.map((entry) => {
      const date = new Date(`${entry.date}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime())) throw new ValidationError(`Invalid date: ${entry.date}`);
      if (date < today) throw new ValidationError(`Cannot set availability for a past date: ${entry.date}`);
      return { ...entry, date };
    });

    await prisma.$transaction(
      parsed.map(({ date, status, note }) =>
        status === null
          ? prisma.vendorAvailability.deleteMany({ where: { vendorId: profile.vendorId, date } })
          : prisma.vendorAvailability.upsert({
              where: { vendorId_date: { vendorId: profile.vendorId, date } },
              create: { vendorId: profile.vendorId, date, status, note: note || null },
              update: { status, note: note || null },
            })
      )
    );

    const updated = await prisma.vendorAvailability.findMany({
      where: { vendorId: profile.vendorId, date: { in: parsed.map((p) => p.date) } },
      select: { date: true, status: true, note: true },
      orderBy: { date: 'asc' },
    });
    return updated.map((item) => ({ ...item, date: item.date.toISOString() }));
  },
};
