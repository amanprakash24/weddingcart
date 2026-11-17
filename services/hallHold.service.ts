import type { Prisma } from '@/generated/prisma/client';
import { ConflictError } from '@/lib/errors';
import { holdTimeWords, SHIFT_LABEL, shiftsOverlap, slotState, type Shift } from '@/lib/venue/slots';

// An active hold stops another couple accepting (founder, 17 Nov 2026 — option B). While a hall is held for one couple on a date and
// shift, no other couple's quotation that reserves the same hall, date and an overlapping shift can be accepted or booked. Enforced
// HERE, inside the acceptance / booking transaction (services/quotation.service.ts) — the couple's link and the venue's "record
// acceptance" both go through it, so no screen can get round it.
//
// Race safety: before checking, the transaction takes the same advisory lock per hall and date that hold() and block() take
// (services/venueSpace.service.ts, key hall:<spaceId>:<date>). A hold and an acceptance on the same hall and date therefore run one
// after the other, never together, and each sees the other's committed result.
//
// Expired holds never block: a hold counts only while holdUntil is in the future AND its enquiry still reads as held (not accepted,
// booked or closed — lib/venue/slots.ts slotState). When the holding couple themselves accept, their hold is taken over: the slot
// stays (it now counts through the booking) and its hold is cleared — no second reservation is made.

type Tx = Prisma.TransactionClient;

export const hallLockKey = (spaceId: string, day: string) => `hall:${spaceId}:${day}`;
const dayOf = (d: Date) => d.toISOString().slice(0, 10);
const dayWords = (day: string) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00.000Z`));

// The words the couple (on their link) and the venue (recording an acceptance) both read. Never names the other couple.
export function heldMessage(hall: string, shift: Shift, day: string, until: Date): string {
  const when = shift === 'FULL_DAY' ? `the full day of ${dayWords(day)}` : `the ${SHIFT_LABEL[shift].toLowerCase()} of ${dayWords(day)}`;
  return `${hall} is temporarily held for another booking for ${when}, until ${holdTimeWords(until.toISOString())}. This quotation can be accepted once that hold ends or the venue releases it — please contact the venue.`;
}

// Refuses (ConflictError) when another couple's running hold covers one of this enquiry's halls; otherwise takes over this
// enquiry's own holds. Call inside the acceptance / booking transaction, after the quotation's own locks.
export async function claimHallsForAcceptance(tx: Tx, consultationId: string, now: Date): Promise<void> {
  const mine = await tx.venueSlot.findMany({ where: { consultationId }, select: { spaceId: true, date: true, shift: true, businessId: true } });
  if (mine.length === 0) return;

  for (const key of [...new Set(mine.map((s) => hallLockKey(s.spaceId, dayOf(s.date))))].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }

  const others = await tx.venueSlot.findMany({
    where: {
      businessId: mine[0].businessId,
      consultationId: { not: consultationId }, // a hold always has an enquiry, so this never drops a held row
      holdUntil: { gt: now },
      OR: mine.map((s) => ({ spaceId: s.spaceId, date: s.date })),
    },
    select: {
      spaceId: true,
      date: true,
      shift: true,
      holdUntil: true,
      space: { select: { name: true } },
      consultation: { select: { id: true, name: true, pipelineStage: true, bookings: { select: { status: true, wedding: { select: { id: true, weddingNumber: true } } } } } },
    },
    orderBy: { holdUntil: 'asc' },
  });

  for (const o of others) {
    if (slotState(o.consultation, o.holdUntil, now) !== 'HELD') continue;
    const hit = mine.find((m) => m.spaceId === o.spaceId && dayOf(m.date) === dayOf(o.date) && shiftsOverlap(m.shift as Shift, o.shift as Shift));
    if (hit) throw new ConflictError(heldMessage(o.space.name, hit.shift as Shift, dayOf(o.date), o.holdUntil!));
  }

  // This couple's own holds are taken over by the acceptance: the slots stay, the holds end.
  await tx.venueSlot.updateMany({ where: { consultationId, holdUntil: { not: null } }, data: { holdUntil: null, heldById: null } });
}
