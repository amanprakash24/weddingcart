import { z } from 'zod';

// Public, unauthenticated endpoint (app/api/enquiries POST) — previously had
// zero validation anywhere in its chain (production-readiness audit
// finding). eventDate is the exact field the original malformed production
// data ("20 October 20202") came through — same strict YYYY-MM-DD
// regex+refine already used for Booking.weddingDate (app/api/bookings
// /schema.ts), but kept as a plain string rather than transformed to a
// Date: Enquiry.eventDate is a String column, not DateTime, so this only
// validates the shape without changing what gets persisted. guestCount
// stays a string (Enquiry.guestCount is String?, not Int, unlike
// Consultation's).
export const enquiryCreateSchema = z.object({
  vendorId: z.string().trim().min(1, 'vendorId is required').max(200),
  vendorName: z.string().trim().min(1, 'vendorName is required').max(200),
  vendorCategory: z.string().trim().min(1, 'vendorCategory is required').max(200),
  name: z.string().trim().min(1, 'Name is required').max(200),
  phone: z.string().trim().min(1, 'Phone is required').max(200),
  email: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, 'City is required').max(200),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'eventDate must be a valid YYYY-MM-DD date')
    .refine((s) => !isNaN(new Date(s).getTime()), 'eventDate must be a valid date'),
  guestCount: z.string().trim().max(50).optional(),
  eventType: z.string().trim().min(1, 'eventType is required').max(200),
  message: z.string().trim().max(2000).optional(),
});
