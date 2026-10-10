import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { dayRange, sameDateBookings, type SameDateView } from '@/lib/venue/sameDate';

// "You already have a booking on this date" for one of a business's own enquiries (lib/venue/sameDate.ts). Read-only, and a warning
// only — nothing here stops a quotation, a booking or a payment. Always called inside the business's scope
// (lib/ownership/venueEntry.ts): the database guard limits both reads to that business, so another business's enquiry is "not
// found" and another business's bookings are never counted.
//
// What it checks: the business's OWN bookings (made from its own accepted quotations). Not yet: the functions of a wedding moved to
// another day, and a wedding of Shaadi Shopping's that this business is booked on.

export interface VenueSameDateDeps {
  db: {
    consultation: Pick<typeof prisma.consultation, 'findUnique'>;
    booking: Pick<typeof prisma.booking, 'findMany'>;
  };
}

export function createVenueSameDateService(deps: VenueSameDateDeps = { db: prisma }) {
  return {
    // The date checked is the one asked for (the date being picked for the booking), or else the enquiry's own wedding date.
    async forEnquiry(enquiryId: string, date?: string | null): Promise<SameDateView> {
      const enquiry = await deps.db.consultation.findUnique({ where: { id: enquiryId }, select: { id: true, weddingDate: true } });
      if (!enquiry) throw new NotFoundError('Enquiry', enquiryId);
      const day = date?.trim() || enquiry.weddingDate;
      const range = dayRange(day);
      if (!range) return { date: null, bookings: [] };
      const rows = await deps.db.booking.findMany({
        where: { weddingDate: range },
        select: { name: true, status: true, consultationId: true, wedding: { select: { id: true, weddingNumber: true } } },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });
      return { date: day, bookings: sameDateBookings(rows, enquiryId) };
    },
  };
}

export const venueSameDateService = createVenueSameDateService();
