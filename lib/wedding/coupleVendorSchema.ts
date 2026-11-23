import { z } from 'zod';
import { QUOTE_STATUSES } from '@/lib/wedding/coupleVendors';

// Request shapes for couple vendors and quote requests (rules: lib/wedding/coupleVendors.ts).
export const ownVendorBody = z.object({
  name: z.string().max(300),
  category: z.string().max(200),
  phone: z.string().max(30).nullish(),
  price: z.number().nullish(),
  notes: z.string().max(1000).nullish(),
  weddingEventId: z.string().max(64).nullish(),
});

export const quoteRequestBody = z.object({
  vendorId: z.string().max(64),
  weddingEventId: z.string().max(64).nullish(),
  note: z.string().max(1000).nullish(),
});

export const quoteAnswerBody = z.object({
  status: z.enum(QUOTE_STATUSES),
  staffNote: z.string().max(1000).nullish(),
  seenUpdatedAt: z.string().datetime(),
});
