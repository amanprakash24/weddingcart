import { prisma } from '@/lib/prisma';
import { buildCalendar, CALENDAR_MAX_BOOKINGS, calendarWindow, type VenueCalendar } from '@/lib/venue/calendar';

// "Availability" in Vendor OS (lib/venue/calendar.ts): the business's own bookings for this month and the next eleven, by wedding
// date. Read-only. Always called inside the business's scope (lib/ownership/venueEntry.ts): bookings are owned records, so the
// database guard reads this business's only — another business's dates never show.

export interface VenueCalendarDeps {
  db: { booking: Pick<typeof prisma.booking, 'findMany'> };
  now: () => Date;
}

const defaultDeps = (): VenueCalendarDeps => ({ db: prisma, now: () => new Date() });

export function createVenueCalendarService(deps: VenueCalendarDeps = defaultDeps()) {
  return {
    async get(): Promise<VenueCalendar> {
      const now = deps.now();
      const rows = await deps.db.booking.findMany({
        where: { weddingDate: calendarWindow(now).range, status: { not: 'CLOSED' } },
        select: { name: true, status: true, weddingDate: true, consultationId: true, wedding: { select: { id: true, weddingNumber: true } } },
        orderBy: [{ weddingDate: 'asc' }, { createdAt: 'asc' }],
        take: CALENDAR_MAX_BOOKINGS,
      });
      return buildCalendar(rows, now);
    },
  };
}

export const venueCalendarService = createVenueCalendarService();
