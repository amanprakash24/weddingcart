// Same source data as lib/vendor/weddingsView.ts (services/venuePortal.service.ts's getDashboard, already
// vendor-scoped) but bucketed per service/booking instead of per wedding — the Vendor -> Services screen is
// service-oriented, not wedding-oriented. Pure: no database, no framework. Reuses isOverdue and
// NEXT_VENUE_STATUS from weddingsView.ts (the single source for both) rather than redefining either.
import { isOverdue, NEXT_VENUE_STATUS, type VendorBookingRow } from './weddingsView';

export interface VendorServiceCard {
  bookingId: string;
  weddingName: string;
  weddingReference: string;
  function: string;
  serviceName: string | null;
  serviceDescription: string | null;
  date: string;
  startTime: string | null;
  venueName: string | null;
  city: string;
  agreedAmount: number;
  status: VendorBookingRow['bookingStatus'];
  venueStatus: VendorBookingRow['venueStatus'];
  nextVenueStatus: VendorBookingRow['venueStatus'] | null;
  overdueTasks: { id: string; title: string }[];
  bucket: 'needs-attention' | 'upcoming' | 'completed';
  nextAction: string | null;
}

export function buildVendorServicesView(bookings: VendorBookingRow[]): VendorServiceCard[] {
  const now = Date.now();

  const cards = bookings.map((b): VendorServiceCard => {
    const overdueTasks = b.tasks.filter((t) => isOverdue(t.dueAt, t.status)).map((t) => ({ id: t.id, title: t.title }));
    const needsAttention = b.bookingStatus === 'PENDING_VENDOR_CONFIRMATION' || overdueTasks.length > 0;
    const isClosed = b.bookingStatus === 'COMPLETED' || b.bookingStatus === 'CANCELLED';
    const isPast = new Date(b.event.date).getTime() < now;
    const bucket: VendorServiceCard['bucket'] = needsAttention ? 'needs-attention' : isClosed || isPast ? 'completed' : 'upcoming';

    let nextAction: string | null = null;
    if (b.bookingStatus === 'PENDING_VENDOR_CONFIRMATION') nextAction = 'Respond to this booking request';
    else if (overdueTasks.length > 0) nextAction = `${overdueTasks[0].title} is overdue`;
    else if (bucket === 'upcoming') nextAction = `Service on ${new Date(b.event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}`;

    return {
      bookingId: b.id,
      weddingName: b.event.name,
      weddingReference: b.event.reference,
      function: b.event.function,
      serviceName: b.requirements?.name ?? null,
      serviceDescription: b.requirements?.description ?? null,
      date: b.event.date,
      startTime: b.event.startTime,
      venueName: b.event.venueName,
      city: b.event.city,
      agreedAmount: b.amount,
      status: b.bookingStatus,
      venueStatus: b.venueStatus,
      nextVenueStatus: NEXT_VENUE_STATUS[b.venueStatus],
      overdueTasks,
      bucket,
      nextAction,
    };
  });

  return cards.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
