import { z } from 'zod';

// Public, unauthenticated endpoint (app/api/bookings POST) — bounds every
// client-controllable field. price/total are still server-recomputed in
// bookingService.create() from the real VendorPackage price; quantity is the
// one number that flows straight into that recomputation, so it gets its own
// explicit range. Kept in its own module (not inline in route.ts) so it's
// unit-testable — a route.ts file may only export HTTP method handlers.
// weddingDate/weddingType/guestCount are optional and additive — the public
// /cart checkout form doesn't currently collect or submit them, so every
// existing caller continues to work exactly as before with all three left
// unset. Added so a future caller (e.g. an admin "create booking from
// enquiry" flow) can populate them at creation time, since neither this
// route nor the booking status-update route has ever set weddingDate any
// other way — without it, convertBookingToWedding() (services/wedding
// Conversion.service.ts) can never complete for a booking created without
// one (production-integrity finding).
//
// weddingDate is deliberately a strict YYYY-MM-DD string (the exact and
// only shape a real caller can produce — an HTML <input type="date">, and
// the only shape sent over JSON either way), not z.coerce.date(). Found
// while wiring up the Enquiry->Booking form: real Enquiry.eventDate data
// includes free-text-shaped values like "20 October 20202" (a typo'd year),
// and JS's Date constructor parses that into a *valid* Date 18000 years in
// the future rather than failing — z.coerce.date() would have silently
// accepted it. Rejecting anything that isn't the exact YYYY-MM-DD shape
// closes that off at the schema level, not just in the new form's own
// client-side validation.
export const bookingCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  phone: z.string().trim().min(1, 'Phone is required').max(200),
  city: z.string().trim().min(1, 'City is required').max(200),
  total: z.number(),
  weddingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'weddingDate must be a valid YYYY-MM-DD date')
    .refine((s) => !isNaN(new Date(s).getTime()), 'weddingDate must be a valid date')
    .optional()
    .transform((s) => (s === undefined ? undefined : new Date(s))),
  weddingType: z.string().trim().max(200).optional(),
  guestCount: z.coerce.number().int().positive().optional(),
  items: z
    .array(
      z.object({
        vendorId: z.string().trim().min(1).max(200),
        vendorName: z.string().trim().min(1).max(200),
        vendorCategory: z.string().trim().min(1).max(200),
        packageName: z.string().trim().min(1).max(200),
        price: z.number(),
        quantity: z.number().int().min(1, 'Quantity must be at least 1').max(50, 'Quantity cannot exceed 50'),
      })
    )
    .min(1, 'At least one item is required')
    .max(50, 'Too many items'),
});
