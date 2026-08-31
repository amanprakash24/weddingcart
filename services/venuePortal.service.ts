import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { VenueBookingStatus } from '@/generated/prisma/enums';

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
    return prisma.vendorBooking.update({ where: { id: bookingId }, data: { venueStatus } });
  },
};
