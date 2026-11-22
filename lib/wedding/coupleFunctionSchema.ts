import { z } from 'zod';

// The body of a couple's function (My Wedding → Functions). Shapes only; the rules are in lib/wedding/coupleFunctions.ts.
export const coupleFunctionBody = z.object({
  type: z.string().max(20),
  name: z.string().max(200).nullish(),
  date: z.string().max(10),
  startTime: z.string().max(5).nullish(),
  endTime: z.string().max(5).nullish(),
  place: z.enum(['BOOKED_VENUE', 'ELSEWHERE']),
  venueSpaceId: z.string().max(64).nullish(),
  venueName: z.string().max(400).nullish(),
  venueAddress: z.string().max(600).nullish(),
  description: z.string().max(1000).nullish(),
});

// Staff deciding on a couple's function. seenUpdatedAt = the version they looked at.
export const functionDecisionBody = z.object({
  decision: z.enum(['CONFIRM', 'NOT_POSSIBLE']),
  note: z.string().max(600).nullish(),
  seenUpdatedAt: z.string().datetime(),
});
