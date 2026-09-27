import { z } from 'zod';

// Public, unauthenticated endpoint (app/api/consultations POST, the /plan
// wizard) — previously had zero validation anywhere in its chain
// (production-readiness audit finding), unlike its rate-limited sibling
// routes. weddingDate gets the same strict YYYY-MM-DD regex+refine already
// used for Booking.weddingDate/Enquiry.eventDate, kept as a plain string
// (Consultation.weddingDate is a String column, not DateTime) — this only
// validates the shape without changing what gets persisted. days/
// guestCount/totalBudget are Int columns but the route previously passed
// whatever the request body contained straight into Prisma.create() with
// no coercion at all; z.coerce.number() here mirrors the same defensive
// pattern already used for Booking.guestCount.
//
// weddingStyle/consultationDate are deliberately NOT part of this schema.
// budgetRange is persisted separately from totalBudget, which remains the
// actual cart/planning amount.
export const consultationCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  phone: z.string().trim().min(1, 'Phone is required').max(200),
  email: z.string().trim().max(200).optional(),
  city: z.string().trim().max(200).optional(),
  eventType: z.string().trim().min(1).max(200).optional(),
  weddingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'weddingDate must be a valid YYYY-MM-DD date')
    .refine((s) => !isNaN(new Date(s).getTime()), 'weddingDate must be a valid date'),
  days: z.coerce.number().int().positive(),
  guestCount: z.coerce.number().int().positive(),
  foodPreference: z.string().trim().max(50).optional(),
  services: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  venueType: z.string().trim().max(100).optional(),
  preferredTime: z.string().trim().max(50).optional(),
  message: z.string().trim().max(2000).optional(),
  // any, not unknown — Prisma.ConsultationCreateInput's cartItems expects
  // NullableJsonNullValueInput | InputJsonValue, and this field is
  // deliberately not deep-validated (a flexible cart snapshot).
  cartItems: z.any().optional(),
  totalBudget: z.coerce.number().int().nonnegative().optional(),
  budgetRange: z.string().trim().max(50).optional(),
});
