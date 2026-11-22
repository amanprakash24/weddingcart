import { z } from 'zod';
import { GuestRsvpStatus, GuestSide } from '@/generated/prisma/enums';

// The one shape for adding or editing a guest, used by the couple's (My Wedding) and the staff guest routes.
// Optional details accept null as well as a missing value: the guest editor sends back the guest it loaded, and a detail
// that was never filled in comes from the database as null. Before (found 19 Nov 2026) null was refused, so changing any
// guest's RSVP status or name failed — notes is never filled in by the form, so that was every guest.
// Guest management fields (side, family group, relation, VIP, "comes with", per-function invitations): 19 Nov 2026.
const optionalText = z.string().max(500).nullish();

export const guestInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: optionalText,
  email: z.string().trim().email().nullish().or(z.literal('')),
  category: optionalText,
  accompanyingGuests: z.coerce.number().int().min(0).max(20).default(0),
  rsvpStatus: z.nativeEnum(GuestRsvpStatus).default(GuestRsvpStatus.PENDING),
  notes: z.string().max(2000).nullish(), // "Special requirements"
  side: z.nativeEnum(GuestSide).nullish(),
  familyGroup: z.string().trim().max(120).nullish(),
  relation: z.string().trim().max(120).nullish(),
  isVip: z.boolean().default(false),
  pairedGuestId: z.string().min(1).nullish(),
  // The functions the guest is invited to, each with their answer so far. Empty = invited to every function.
  functionResponses: z.array(z.object({ weddingEventId: z.string().min(1), status: z.nativeEnum(GuestRsvpStatus) })).default([]),
});
