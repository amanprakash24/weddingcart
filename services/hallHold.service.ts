import type { Prisma } from '@/generated/prisma/client';
import { ConflictError } from '@/lib/errors';
import { blockingClash, hallUnavailableWords, isShift, slotOf, type Shift, type Slot } from '@/lib/venue/slots';

// A couple's quotation cannot be accepted, or booked, while its hall + date + shift is TAKEN by anyone else (founder, 17 Nov 2026 —
// option B, extended by decision A): booked, accepted, held (until the hold ends) or blocked by hand. The rule itself is
// lib/venue/slots.ts blockingClash — the couple's page shows the same rule before they press Accept. Enforced HERE, inside the
// acceptance / booking transaction (services/quotation.service.ts): the couple's link and the venue's "record acceptance" both go
// through it, so no screen can get round it.
//
// Race safety: before checking, the transaction takes the advisory lock per hall and date (key hall:<spaceId>:<date>) that hold(),
// release, block() and every other acceptance take. Two couples accepting the same hall, or a hold / block and an acceptance, run one
// after the other — the second sees the first's committed result.
//
// Expired holds never block. When the holding couple themselves accept, their hold is taken over: the slot stays (it now counts
// through the booking) and its hold is cleared — no second reservation is made.

type Tx = Prisma.TransactionClient;

export const hallLockKey = (spaceId: string, day: string) => `hall:${spaceId}:${day}`;
const dayOf = (d: Date) => d.toISOString().slice(0, 10);

const ENQUIRY = { select: { id: true, name: true, pipelineStage: true, bookings: { select: { status: true, wedding: { select: { id: true, weddingNumber: true } } } } } } as const;

// Refuses (ConflictError) when one of this enquiry's halls is taken by someone else; otherwise takes over this enquiry's own holds.
// Call inside the acceptance / booking transaction, after the quotation's own locks.
export async function claimHallsForAcceptance(tx: Tx, consultationId: string, now: Date): Promise<void> {
  const mine = await tx.venueSlot.findMany({ where: { consultationId }, select: { id: true, spaceId: true, date: true, shift: true, businessId: true, space: { select: { name: true } } } });
  if (mine.length === 0) return;

  for (const key of [...new Set(mine.map((s) => hallLockKey(s.spaceId, dayOf(s.date))))].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }

  // Everything on the same halls and dates — other couples' slots AND the venue's hand blocks (no enquiry). This enquiry's own rows
  // are left out by blockingClash (same enquiry), never by SQL (a NOT on the column would also drop the blocks).
  const rows = await tx.venueSlot.findMany({
    where: { businessId: mine[0].businessId, OR: mine.map((s) => ({ spaceId: s.spaceId, date: s.date })) },
    select: { id: true, spaceId: true, date: true, shift: true, note: true, holdUntil: true, consultation: ENQUIRY },
  });
  const around = rows.map((r) => slotOf(r, now)).filter((s): s is Slot => s !== null);

  for (const m of mine) {
    if (!isShift(m.shift)) continue;
    const taken = blockingClash({ id: m.id, spaceId: m.spaceId, date: dayOf(m.date), shift: m.shift as Shift, enquiryId: consultationId }, around);
    if (taken) throw new ConflictError(hallUnavailableWords({ hall: m.space.name, shift: m.shift as Shift, date: dayOf(m.date), heldUntil: taken.state === 'HELD' ? taken.holdUntil : null }));
  }

  // This couple's own holds are taken over by the acceptance: the slots stay, the holds end.
  await tx.venueSlot.updateMany({ where: { consultationId, holdUntil: { not: null } }, data: { holdUntil: null, heldById: null } });
}
