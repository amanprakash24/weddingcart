import { Prisma } from '@/generated/prisma/client';
import { ActivityType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { functionDeleteBlocker, primaryDateFor } from '@/lib/wedding/functions';
import { changeNeedsApproval, coupleFunctionFields, coupleFunctionProblem, coupleMayChange, functionDisplayName, pendingFromFields, sameAsCurrent, typeChangeProblem, type CoupleFunctionInput, type PendingFunctionChange } from '@/lib/wedding/coupleFunctions';

// Couple-controlled functions (22 Nov 2026, Client OS).
//
// The couple (My Wedding) adds, edits and removes their OWN functions. Callers run these inside asCoupleWedding (the wedding must be
// this couple's, and the work runs in that wedding's business). A function at the booked venue is WAITING until authorised staff — Shaadi
// Shopping's team on its weddings, the venue's own team on a venue's — confirm it or say it is not possible.
//
// What this never does: change the venue booking, a hall hold, availability, a vendor booking or the agreed price. A couple's edit of a
// planner-set function or the confirmed Wedding is only a request (pendingChange); the wedding's date moves only when staff confirm it.
// Every change is one transaction with the function row locked, and is written to the wedding's history with who made it.

type Tx = Prisma.TransactionClient;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const dayWords = (d: Date) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);

async function openWedding(tx: Tx | typeof prisma, weddingId: string) {
  const wedding = await tx.wedding.findUnique({ where: { id: weddingId }, select: { id: true, status: true, businessId: true } });
  if (!wedding) throw new NotFoundError('Wedding', weddingId);
  if (wedding.status === 'COMPLETED' || wedding.status === 'CANCELLED') throw new ValidationError(`This wedding is ${wedding.status.toLowerCase()} — its functions can no longer be changed`);
  return wedding;
}

// A space must be one of the wedding's own business's active spaces (a venue's hall). Shaadi Shopping's weddings have none.
async function checkSpace(tx: Tx, businessId: string, spaceId: string | null) {
  if (!spaceId) return null;
  const space = await tx.venueSpace.findFirst({ where: { id: spaceId, businessId, active: true }, select: { id: true, name: true } });
  if (!space) throw new ValidationError('Choose one of the venue’s halls');
  return space;
}

async function lockFunction(tx: Tx, weddingId: string, eventId: string) {
  await tx.$queryRaw`SELECT "id" FROM "wedding_events" WHERE "id" = ${eventId} FOR UPDATE`;
  const event = await tx.weddingEvent.findUnique({ where: { id: eventId } });
  if (!event || event.weddingId !== weddingId) throw new NotFoundError('WeddingEvent', eventId);
  return event;
}

async function log(tx: Tx, weddingId: string, summary: string, actorId: string | null) {
  await tx.activityLog.create({ data: { type: ActivityType.STATUS_CHANGED, summary, weddingId, performedById: actorId } });
}

// Wedding.primaryDate follows the main function — only ever from a staff confirmation.
async function syncWeddingDate(tx: Tx, weddingId: string) {
  const [w, events] = await Promise.all([
    tx.wedding.findUniqueOrThrow({ where: { id: weddingId }, select: { primaryDate: true } }),
    tx.weddingEvent.findMany({ where: { weddingId, confirmation: 'CONFIRMED' }, select: { type: true, date: true } }),
  ]);
  const next = primaryDateFor(events, w.primaryDate);
  if (next) await tx.wedding.update({ where: { id: weddingId }, data: { primaryDate: next } });
}

function waitingWords(f: { confirmation: string; atBookedVenue: boolean }, spaceName: string | null) {
  return f.confirmation === 'WAITING' ? ` — at the booked venue${spaceName ? ` (${spaceName})` : ''}, waiting for confirmation` : '';
}

export const coupleFunctionsService = {
  // ---------- the couple ----------

  async add(weddingId: string, input: CoupleFunctionInput, coupleUserId: string) {
    const problem = coupleFunctionProblem(input, today());
    if (problem) throw new ValidationError(problem);
    const fields = coupleFunctionFields(input);
    return prisma.$transaction(async (tx) => {
      const wedding = await openWedding(tx, weddingId);
      if (fields.type === 'WEDDING' && (await tx.weddingEvent.count({ where: { weddingId, type: 'WEDDING' } })) > 0) throw new ValidationError('Your Wedding is already on the schedule — open it and press Change');
      const space = await checkSpace(tx, wedding.businessId, fields.venueSpaceId);
      const created = await tx.weddingEvent.create({
        data: { ...fields, weddingId, city: (await tx.wedding.findUniqueOrThrow({ where: { id: weddingId }, select: { city: true } })).city, addedByCouple: true },
      });
      await log(tx, weddingId, `The couple added ${functionDisplayName(created)} on ${dayWords(created.date)}${waitingWords(created, space?.name ?? null)}`, coupleUserId);
      return created;
    });
  },

  async update(weddingId: string, eventId: string, input: CoupleFunctionInput, coupleUserId: string) {
    const problem = coupleFunctionProblem(input, today());
    if (problem) throw new ValidationError(problem);
    const fields = coupleFunctionFields(input);
    return prisma.$transaction(async (tx) => {
      const wedding = await openWedding(tx, weddingId);
      const event = await lockFunction(tx, weddingId, eventId);
      const kind = typeChangeProblem(event.type, fields.type);
      if (kind) throw new ValidationError(kind);
      const space = await checkSpace(tx, wedding.businessId, fields.venueSpaceId);
      if (changeNeedsApproval(event)) {
        const proposed = pendingFromFields(fields);
        if (sameAsCurrent(event, proposed)) {
          if (!event.pendingChange) return event; // nothing to ask for
          const back = await tx.weddingEvent.update({ where: { id: eventId }, data: { pendingChange: Prisma.DbNull, confirmation: 'CONFIRMED', confirmationNote: null } });
          await log(tx, weddingId, `The couple withdrew their requested change to ${functionDisplayName(event)}`, coupleUserId);
          return back;
        }
        const asked = await tx.weddingEvent.update({
          where: { id: eventId },
          data: { pendingChange: proposed as unknown as Prisma.InputJsonValue, confirmation: 'WAITING', confirmationNote: null, confirmedById: null, confirmedAt: null },
        });
        await log(tx, weddingId, `The couple asked to change ${functionDisplayName(event)} (${dayWords(event.date)}) — to ${functionDisplayName(proposed)} on ${dayWords(new Date(`${proposed.date}T00:00:00Z`))}; waiting for confirmation`, coupleUserId);
        return asked;
      }
      // Any edit of a function at the booked venue goes back to staff — even one they had confirmed (the date, time or hall may have
      // moved). One moved away from the venue no longer touches the booking and stands at once.
      const updated = await tx.weddingEvent.update({
        where: { id: eventId },
        data: { ...fields, confirmationNote: null, confirmedById: null, confirmedAt: null },
      });
      await log(tx, weddingId, `The couple changed ${functionDisplayName(updated)} (${dayWords(updated.date)})${waitingWords(updated, space?.name ?? null)}`, coupleUserId);
      return updated;
    });
  },

  async remove(weddingId: string, eventId: string, coupleUserId: string) {
    return prisma.$transaction(async (tx) => {
      await openWedding(tx, weddingId);
      const event = await lockFunction(tx, weddingId, eventId);
      if (!coupleMayChange(event)) throw new ValidationError('This function is part of your booking — ask your planner to remove it');
      const [vendorBookings, guestReplies] = await Promise.all([
        tx.vendorBooking.count({ where: { weddingEventId: eventId, status: { notIn: ['DECLINED', 'CANCELLED'] } } }),
        tx.guestFunctionResponse.count({ where: { weddingEventId: eventId, status: { not: 'PENDING' } } }),
      ]);
      const blocker = functionDeleteBlocker({ isLastFunction: false, vendorBookings, servicesWithoutVendor: 0, guestReplies });
      if (blocker) throw new ValidationError(blocker);
      await tx.weddingEvent.delete({ where: { id: eventId } });
      await log(tx, weddingId, `The couple removed ${functionDisplayName(event)} (${dayWords(event.date)})`, coupleUserId);
      return { removed: true as const };
    });
  },

  // ---------- staff (Shaadi Shopping's team, or the venue's own) ----------

  // Confirm a couple's function, or say it is not possible (with the reason the couple will read). `seenUpdatedAt` is the version the
  // person looked at: if the couple changed it since, the decision is refused (409) so nobody confirms something they did not see.
  // Confirming changes nothing about the venue booking, holds or price — staff check those themselves before they confirm.
  async decide(weddingId: string, eventId: string, input: { decision: 'CONFIRM' | 'NOT_POSSIBLE'; note?: string | null; seenUpdatedAt: string }, actorId: string | null) {
    const note = input.note?.trim() || null;
    if (input.decision === 'NOT_POSSIBLE' && !note) throw new ValidationError('Tell the couple why it is not possible');
    if (note && note.length > 300) throw new ValidationError('Keep the reason under 300 characters');
    return prisma.$transaction(async (tx) => {
      const wedding = await openWedding(tx, weddingId);
      const event = await lockFunction(tx, weddingId, eventId);
      if (event.updatedAt.toISOString() !== new Date(input.seenUpdatedAt).toISOString()) {
        throw new ConflictError('The couple changed this function since you opened it — look at it again before deciding');
      }
      if (event.confirmation === 'CONFIRMED') {
        if (input.decision === 'CONFIRM') return event; // already confirmed: nothing to do (a double click)
        throw new ConflictError('This function is already confirmed');
      }
      if (event.confirmation === 'NOT_POSSIBLE' && input.decision === 'NOT_POSSIBLE') return event;
      // A requested change to a planner-set function: confirming applies it; "not possible" leaves the function exactly as it was.
      const pending = event.pendingChange as unknown as PendingFunctionChange | null;
      if (pending) {
        if (input.decision === 'CONFIRM') await checkSpace(tx, wedding.businessId, pending.venueSpaceId);
        const decided = await tx.weddingEvent.update({
          where: { id: eventId },
          data:
            input.decision === 'CONFIRM'
              ? { ...pending, type: pending.type as never, date: new Date(`${pending.date}T00:00:00Z`), pendingChange: Prisma.DbNull, confirmation: 'CONFIRMED', confirmationNote: null, confirmedById: actorId, confirmedAt: new Date() }
              : { pendingChange: Prisma.DbNull, confirmation: 'CONFIRMED', confirmationNote: note, confirmedById: actorId, confirmedAt: new Date() },
        });
        if (input.decision === 'CONFIRM') await syncWeddingDate(tx, weddingId);
        await log(tx, weddingId, input.decision === 'CONFIRM' ? `Confirmed the couple's change to ${functionDisplayName(decided)} (${dayWords(decided.date)})` : `The couple's change to ${functionDisplayName(decided)} is not possible: ${note}`, actorId);
        return decided;
      }
      const updated = await tx.weddingEvent.update({
        where: { id: eventId },
        data:
          input.decision === 'CONFIRM'
            ? { confirmation: 'CONFIRMED', confirmationNote: null, confirmedById: actorId, confirmedAt: new Date() }
            : { confirmation: 'NOT_POSSIBLE', confirmationNote: note, confirmedById: actorId, confirmedAt: new Date() },
      });
      if (input.decision === 'CONFIRM') await syncWeddingDate(tx, weddingId);
      await log(
        tx,
        weddingId,
        input.decision === 'CONFIRM' ? `Confirmed the couple's ${functionDisplayName(updated)} (${dayWords(updated.date)})` : `The couple's ${functionDisplayName(updated)} (${dayWords(updated.date)}) is not possible: ${note}`,
        actorId
      );
      return updated;
    });
  },
};
