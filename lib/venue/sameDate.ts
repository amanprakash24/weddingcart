// "You already have a booking on this date" — a WARNING for a business, never a block: a venue with two halls, or a caterer with two
// teams, takes two weddings on one day on purpose. Pure: services/venueSameDate.service.ts loads the bookings, this says what counts.

// Another booking of the same business on the same date.
export interface SameDateBooking {
  name: string; // the customer
  confirmed: boolean; // the amount to confirm was received; false = the couple accepted, the booking is not confirmed yet
  enquiryId: string | null; // the enquiry it came from — /vendor/enquiries/[id]
  wedding: { id: string; number: string } | null; // the wedding it became — /vendor/weddings/[id]
}

export interface SameDateView {
  date: string | null; // the YYYY-MM-DD that was checked; null = no clear date to check yet
  bookings: SameDateBooking[];
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// A wedding date is stored as the start of its day (lib/quotation/booking.ts resolveSourceDate), so "the same date" is that whole
// day. null = not a real YYYY-MM-DD (free text, or a date that does not exist such as 2026-02-31).
export function dayRange(day: string | null | undefined): { gte: Date; lt: Date } | null {
  if (!day || !DAY.test(day)) return null;
  const gte = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(gte.getTime()) || gte.toISOString().slice(0, 10) !== day) return null;
  return { gte, lt: new Date(gte.getTime() + 86_400_000) };
}

type Row = { name: string; status: string; consultationId: string | null; wedding: { id: string; weddingNumber: string } | null };

// The bookings that hold the date: not this enquiry's own booking, and not a closed one. Confirmed first.
export function sameDateBookings(rows: Row[], enquiryId: string): SameDateBooking[] {
  return rows
    .filter((r) => r.consultationId !== enquiryId && r.status !== 'CLOSED')
    .map((r) => ({ name: r.name, confirmed: r.status === 'CONFIRMED', enquiryId: r.consultationId, wedding: r.wedding ? { id: r.wedding.id, number: r.wedding.weddingNumber } : null }))
    .sort((a, b) => Number(b.confirmed) - Number(a.confirmed));
}

// The heading of the warning: "You already have a confirmed booking on this date" …
export function sameDateHeading(bookings: SameDateBooking[]): string {
  const confirmed = bookings.filter((b) => b.confirmed).length;
  if (bookings.length === 1) return confirmed ? 'You already have a confirmed booking on this date' : 'Another couple has accepted a quotation for this date';
  return confirmed ? `You already have ${bookings.length} bookings on this date (${confirmed} confirmed)` : `${bookings.length} other couples have accepted a quotation for this date`;
}
