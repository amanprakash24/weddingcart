import { prisma } from '@/lib/prisma';
import { buildCalendar, CALENDAR_MAX_BOOKINGS, calendarWindow, type VenueCalendarView } from '@/lib/venue/calendar';
import { venueSpaceService } from './venueSpace.service';

// "Availability" in Vendor OS (lib/venue/calendar.ts): the business's own bookings for this month and the next eleven, by wedding
// date. Read-only. Always called inside the business's scope (lib/ownership/venueEntry.ts): bookings are owned records, so the
// database guard reads this business's only — another business's dates never show.

export interface VenueCalendarDeps {
  db: { booking: Pick<typeof prisma.booking, 'findMany'> };
  now: () => Date;
  halls: Pick<typeof venueSpaceService, 'calendar'>;
}

const defaultDeps = (): VenueCalendarDeps => ({ db: prisma, now: () => new Date(), halls: venueSpaceService });

export function createVenueCalendarService(deps: VenueCalendarDeps = defaultDeps()) {
  return {
    async get(): Promise<VenueCalendarView> {
      const now = deps.now();
      const { range } = calendarWindow(now);
      // The bookings and the halls do not depend on each other — loaded together.
      const [rows, halls] = await Promise.all([
        deps.db.booking.findMany({
          where: { weddingDate: range, status: { not: 'CLOSED' } },
          select: { name: true, status: true, weddingDate: true, consultationId: true, wedding: { select: { id: true, weddingNumber: true } } },
          orderBy: [{ weddingDate: 'asc' }, { createdAt: 'asc' }],
          take: CALENDAR_MAX_BOOKINGS,
        }),
        deps.halls.calendar(range),
      ]);
      return { ...buildCalendar(rows, now), halls };
    },
  };
}

export const venueCalendarService = createVenueCalendarService();
