// Turns an ACCEPTED quotation into the data for a Booking (docs/wedding-os/08-quotation.md §6.4).
//
// Pure: quotationService loads the source and vendors, this decides what the Booking looks like, so
// every rule is unit-testable without a database.
//
// Prices come from the QUOTE (the negotiated price), never from a vendor's public package list — that is
// the difference from the marketplace cart path (bookingService.create). Booking.total is the quote's
// total; discount and tax live on the quote, which the Booking links to.
import { ValidationError } from '@/lib/errors';
import { UNASSIGNED_VENDOR_NAME } from '@/lib/booking/unassigned';

export interface BookingSource {
  name: string;
  phone: string;
  city: string | null;
  // Both Enquiry.eventDate and Consultation.weddingDate are free text; only a strict, plausible
  // YYYY-MM-DD is trusted (see resolveSourceDate).
  dateText: string | null;
  guestCount: number | null;
  eventType: string | null;
}

// What staff may supply when the source can't provide it (all optional).
export interface BookingOverrides {
  weddingDate?: Date | null;
  guestCount?: number | null;
  weddingType?: string | null;
  city?: string | null;
}

export interface QuotedLine {
  description: string;
  category: string | null;
  functionLabel: string | null;
  vendorId: string | null;
  unitPrice: number;
  quantity: number;
}

export interface QuotedForBooking {
  total: number;
  items: QuotedLine[];
}

export interface BookingPlan {
  name: string;
  phone: string;
  city: string;
  total: number;
  weddingDate: Date;
  weddingType: string | null;
  guestCount: number | null;
  items: {
    vendorId: string | null;
    vendorName: string;
    vendorCategory: string;
    packageName: string;
    price: number;
    quantity: number;
  }[];
}

const STRICT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_YEAR = 2020;
const MAX_YEAR = 2100;

// Real Enquiry.eventDate data contains typo'd free text ("20 October 20202") that JS's Date happily parses
// into a valid date 18,000 years away, so anything that is not an exact, plausible YYYY-MM-DD is treated as
// "unknown" and staff are asked for the date instead.
export function resolveSourceDate(raw: string | null | undefined): Date | null {
  if (!raw || !STRICT_DATE.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // reject rollovers such as 2026-02-31 → 2026-03-03
  if (date.toISOString().slice(0, 10) !== raw) return null;
  const year = date.getUTCFullYear();
  return year >= MIN_YEAR && year <= MAX_YEAR ? date : null;
}

export function isPlausibleDate(date: Date): boolean {
  if (Number.isNaN(date.getTime())) return false;
  const year = date.getUTCFullYear();
  return year >= MIN_YEAR && year <= MAX_YEAR;
}

export function planBookingFromQuotation(input: {
  quotation: QuotedForBooking;
  source: BookingSource;
  vendors: Map<string, { name: string; categoryName: string }>;
  overrides?: BookingOverrides;
}): BookingPlan {
  const { quotation, source, vendors, overrides = {} } = input;

  const city = overrides.city?.trim() || source.city?.trim() || '';
  if (!city) throw new ValidationError('Add the city for this booking — the enquiry does not have one');

  const weddingDate = overrides.weddingDate ?? resolveSourceDate(source.dateText);
  if (!weddingDate) {
    throw new ValidationError(
      'Add the wedding date — the date on this enquiry is missing or not a clear date, and a booking needs one to become a wedding'
    );
  }
  if (!isPlausibleDate(weddingDate)) {
    throw new ValidationError('That wedding date does not look right — please check the year');
  }

  const guestCount = overrides.guestCount ?? source.guestCount;
  if (guestCount !== null && guestCount !== undefined && (!Number.isInteger(guestCount) || guestCount < 1)) {
    throw new ValidationError('Guest count must be a whole number, 1 or more');
  }

  if (quotation.items.length === 0) {
    throw new ValidationError('This quotation has no lines to book');
  }

  const items = quotation.items.map((line) => {
    const vendor = line.vendorId ? vendors.get(line.vendorId) : undefined;
    if (line.vendorId && !vendor) {
      // The vendor named on the quote no longer exists — never silently turn it into an unassigned line.
      throw new ValidationError(`The vendor on the line "${line.description}" no longer exists — edit the quotation first`);
    }
    return {
      vendorId: vendor ? (line.vendorId as string) : null,
      vendorName: vendor ? vendor.name : UNASSIGNED_VENDOR_NAME,
      vendorCategory: vendor ? vendor.categoryName : line.category?.trim() || 'Service',
      packageName: line.functionLabel?.trim() ? `${line.description} (${line.functionLabel.trim()})` : line.description,
      price: line.unitPrice,
      quantity: line.quantity,
    };
  });

  return {
    name: source.name,
    phone: source.phone,
    city,
    total: quotation.total,
    weddingDate,
    weddingType: overrides.weddingType?.trim() || source.eventType?.trim() || null,
    guestCount: guestCount ?? null,
    items,
  };
}
