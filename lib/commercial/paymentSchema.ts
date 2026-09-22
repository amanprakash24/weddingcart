import { z } from 'zod';
import { MANUAL_PAYMENT_METHODS } from '@/lib/invoice/lifecycle';

// The body of "record a payment" — shared by the CRM (before the wedding exists) and the wedding's Money tab, so both accept exactly
// the same thing. `idempotencyKey` is made once per open form: submitting it twice records the payment once.
export const recordPaymentBody = z.object({
  amount: z.number().int().positive(),
  method: z.enum(MANUAL_PAYMENT_METHODS as unknown as [string, ...string[]]),
  reference: z.string().trim().max(120).optional(),
  paidAt: z.string().datetime().optional(),
  idempotencyKey: z.string().trim().min(8).max(64).optional(),
});
