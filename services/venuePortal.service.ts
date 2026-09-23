import { prisma } from '@/lib/prisma';
import { NotFoundError, InvalidTransitionError, ValidationError } from '@/lib/errors';
import { VenueBookingStatus, AvailabilityStatus } from '@/generated/prisma/enums';
import { canTransitionVenueBooking } from '@/lib/wedding/lifecycle';

// A vendor can set at most this many dates in one request — generous enough for
// "block the next 3 months" in one go, small enough to keep the transaction bounded.
const MAX_AVAILABILITY_DATES_PER_REQUEST = 90;

export interface AvailabilityEntry {
  date: string; // 'YYYY-MM-DD'
  status: AvailabilityStatus | null; // null clears the override back to the default (unset = available)
  note?: string;
}

async function vendorForUser(userId: string) {
  const profile = await prisma.vendorProfile.findUnique({
    where: { userId },
    select: { vendorId: true, vendor: { select: { id: true, name: true, city: true, address: true, category: { select: { name: true } } } } },
  });
  if (!profile) throw new NotFoundError('Vendor profile', userId);
  return profile;
}

function bookingView(booking: {
  id: string; status: string; venueStatus: VenueBookingStatus; agreedPrice: number;
  weddingEvent: { id: string; type: string; label: string | null; date: Date; startTime: string | null; venueName: string | null; venueAddress: string | null; city: string; wedding: { id: string; weddingNumber: string; weddingType: string | null; guestCount: number | null; customer: { name: string | null } | null; events: { id: string; type: string; label: string | null; date: Date; startTime: string | null; venueName: string | null; city: string }[] } };
  vendorPackage: { name: string; description: string } | null;
  tasks: { id: string; title: string; status: string; dueAt: Date | null }[];
}) {
  return {
    id: booking.id,
    bookingStatus: booking.status,
    venueStatus: booking.venueStatus,
    amount: booking.agreedPrice,
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
  async getDashboard(userId: string) {
    const profile = await vendorForUser(userId);
    const bookings = await prisma.vendorBooking.findMany({ where: { vendorId: profile.vendorId }, include: bookingInclude, orderBy: { weddingEvent: { date: 'asc' } } });
    const bookingIds = bookings.map((booking) => booking.id);
    const documents = bookingIds.length ? await prisma.document.findMany({ where: { vendorBookingId: { in: bookingIds }, category: { in: ['VENUE_AGREEMENT', 'FLOOR_PLAN', 'MENU', 'QUOTATION'] }, visibility: 'CUSTOMER_VISIBLE' }, select: { id: true, fileName: true, url: true, category: true, vendorBookingId: true, createdAt: true }, orderBy: { createdAt: 'desc' } }) : [];
    const eventIds = bookings.map((booking) => booking.weddingEventId);
    const packageIds = bookings.map((booking) => booking.vendorPackageId).filter((id): id is string => Boolean(id));
    const approvals = eventIds.length ? await prisma.approvalRequest.findMany({
      where: { weddingEventId: { in: eventIds }, subjectId: { in: [...bookingIds, ...packageIds] } },
      select: { id: true, subjectType: true, title: true, status: true, amount: true, weddingEventId: true },
      orderBy: { createdAt: 'desc' },
    }) : [];
    const availability = await prisma.vendorAvailability.findMany({ where: { vendorId: profile.vendorId, date: { gte: new Date() } }, select: { date: true, status: true, note: true }, orderBy: { date: 'asc' }, take: 90 });
    return {
      vendor: profile.vendor,
      bookings: bookings.map(bookingView),
      documents: documents.map((document) => ({ ...document, createdAt: document.createdAt.toISOString() })),
      availability: availability.map((item) => ({ ...item, date: item.date.toISOString() })),
      approvals: approvals.map((approval) => ({ ...approval, title: approval.title || 'Client approval', weddingEventId: approval.weddingEventId })),
    };
  },

  async updateStatus(userId: string, bookingId: string, venueStatus: VenueBookingStatus) {
    const profile = await vendorForUser(userId);
    const booking = await prisma.vendorBooking.findFirst({ where: { id: bookingId, vendorId: profile.vendorId } });
    if (!booking) throw new NotFoundError('Venue booking', bookingId);

    if (!canTransitionVenueBooking(booking.venueStatus, venueStatus)) {
      throw new InvalidTransitionError(`Cannot move venue status from ${booking.venueStatus} to ${venueStatus}`);
    }

    return prisma.vendorBooking.update({ where: { id: bookingId }, data: { venueStatus } });
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
