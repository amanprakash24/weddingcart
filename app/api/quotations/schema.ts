import { z } from 'zod';
import { MAX_LINE_ITEMS } from '@/lib/quotation/totals';
import { ACCEPTANCE_CHANNELS } from '@/lib/quotation/rules';
import { resolveSourceDate } from '@/lib/quotation/booking';

// Deliberately has NO subtotal / total / balance field: the API accepts inputs only, and
// the server recomputes every total (lib/quotation/totals.ts). An unknown extra key is
// stripped by Zod, so a client-sent total can never reach the database.

// Staff type a date ("2026-10-01"); the quote is valid through the end of that day in IST.
const validUntilSchema = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T23:59:59+05:30`) : new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid date' });
      return z.NEVER;
    }
    return date;
  });

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const quotationItemSchema = z.object({
  description: z.string().trim().min(1, 'Describe this line').max(200),
  category: optionalText(60),
  functionLabel: optionalText(60),
  vendorId: z.string().trim().min(1).nullable().optional(),
  unitPrice: z.coerce.number().int('Price must be a whole number of rupees').min(0),
  quantity: z.coerce.number().int('Quantity must be a whole number').min(1),
});

const quotationFields = {
  items: z.array(quotationItemSchema).min(1, 'Add at least one line item').max(MAX_LINE_ITEMS),
  discount: z.coerce.number().int().min(0).default(0),
  gstEnabled: z.boolean().default(false),
  gstAmount: z.coerce.number().int().min(0).default(0),
  advanceAmount: z.coerce.number().int().min(0).default(0),
  validUntil: validUntilSchema,
  terms: optionalText(4000),
  notes: optionalText(4000),
};

const taxNeedsToggle = (value: { gstEnabled: boolean; gstAmount: number }) => value.gstEnabled || value.gstAmount === 0;
const taxNeedsToggleIssue = { message: 'Turn tax on to enter a tax amount', path: ['gstAmount'] };

// PATCH /api/quotations/[id]
export const updateQuotationSchema = z.object(quotationFields).refine(taxNeedsToggle, taxNeedsToggleIssue);

// POST /api/quotations
export const createQuotationSchema = z
  .object({
    sourceType: z.enum(['LEAD', 'ENQUIRY', 'CONSULTATION']),
    sourceId: z.string().trim().min(1),
    ...quotationFields,
  })
  .refine(taxNeedsToggle, taxNeedsToggleIssue);

export type CreateQuotationBody = z.infer<typeof createQuotationSchema>;

// POST /api/quotations/[id]/accept — staff record that the customer said yes (V1: no customer login/link).
export const acceptQuotationSchema = z.object({
  channel: z.enum(ACCEPTANCE_CHANNELS),
  note: optionalText(1000),
});

// POST /api/quotations/[id]/reject — a reason is required.
export const rejectQuotationSchema = z.object({
  reason: z.string().trim().min(1, 'Say why the customer declined').max(1000),
});

// POST /api/quotations/[id]/create-booking — everything is optional: the booking takes its client, city, date
// and guest count from the enquiry/consultation, and staff fill in only what it lacks. The date must be an exact,
// plausible YYYY-MM-DD (free text such as "20 October 20202" is never accepted — see lib/quotation/booking.ts).
export const createBookingSchema = z.object({
  weddingDate: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value, ctx) => {
      if (!value) return undefined;
      const date = resolveSourceDate(value);
      if (!date) {
        ctx.addIssue({ code: 'custom', message: 'Enter the wedding date as a valid date' });
        return z.NEVER;
      }
      return date;
    }),
  guestCount: z.union([z.null(), z.coerce.number().int('Guest count must be a whole number').positive('Guest count must be 1 or more')]).optional(),
  weddingType: optionalText(100),
  city: optionalText(100),
});
