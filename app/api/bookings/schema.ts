import { z } from 'zod';

// Public, unauthenticated endpoint (app/api/bookings POST) — bounds every
// client-controllable field. price/total are still server-recomputed in
// bookingService.create() from the real VendorPackage price; quantity is the
// one number that flows straight into that recomputation, so it gets its own
// explicit range. Kept in its own module (not inline in route.ts) so it's
// unit-testable — a route.ts file may only export HTTP method handlers.
export const bookingCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  phone: z.string().trim().min(1, 'Phone is required').max(200),
  city: z.string().trim().min(1, 'City is required').max(200),
  total: z.number(),
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
