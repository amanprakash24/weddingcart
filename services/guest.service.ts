import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { GuestRsvpStatus, type GuestSide } from '@/generated/prisma/enums';
import { invitedEventIds, answersForInvited } from '@/lib/guest/invitations';

export type GuestInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  category?: string | null;
  accompanyingGuests?: number;
  rsvpStatus?: GuestRsvpStatus;
  notes?: string | null;
  // Guest management (19 Nov 2026)
  side?: GuestSide | null;
  familyGroup?: string | null;
  relation?: string | null;
  isVip?: boolean;
  pairedGuestId?: string | null;
  /** The functions the guest is invited to, with their answer so far. Empty = invited to every function. */
  functionResponses?: { weddingEventId: string; status: GuestRsvpStatus }[];
};

const guestInclude = {
  functionResponses: {
    include: { weddingEvent: { select: { id: true, type: true, label: true, date: true } } },
    orderBy: { weddingEvent: { date: 'asc' as const } },
  },
} as const;

async function assertWedding(weddingId: string) {
  const wedding = await prisma.wedding.findUnique({
    where: { id: weddingId },
    select: { id: true, weddingNumber: true, weddingType: true, primaryDate: true, city: true, guestCount: true, couple: { select: { brideName: true, groomName: true } }, events: { orderBy: { date: 'asc' }, select: { id: true, type: true, label: true, date: true, startTime: true, venueName: true, venueAddress: true, city: true } } },
  });
  if (!wedding) throw new NotFoundError('Wedding', weddingId);
  return wedding;
}

const text = (v: string | null | undefined) => v?.trim() || null;

function normalize(input: GuestInput) {
  return {
    name: input.name.trim(),
    phone: text(input.phone),
    email: text(input.email),
    category: text(input.category),
    accompanyingGuests: Math.max(0, Math.floor(input.accompanyingGuests ?? 0)),
    rsvpStatus: input.rsvpStatus ?? GuestRsvpStatus.PENDING,
    notes: text(input.notes),
    side: input.side ?? null,
    familyGroup: text(input.familyGroup),
    relation: text(input.relation),
    isVip: input.isVip ?? false,
  };
}

function checkFunctions(input: GuestInput, eventIds: Set<string>) {
  const responses = input.functionResponses ?? [];
  if (responses.some((r) => !eventIds.has(r.weddingEventId))) throw new ValidationError('A function does not belong to this wedding');
  // One row per function.
  return [...new Map(responses.map((r) => [r.weddingEventId, r])).values()];
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// "Comes with": keep both guests pointing at each other, and no one else pointing at either. `partnerId` null = unpair.
async function setPartner(tx: Tx, weddingId: string, guestId: string, partnerId: string | null) {
  if (partnerId === guestId) throw new ValidationError('A guest cannot come with themselves');
  if (partnerId) {
    const partner = await tx.guest.findFirst({ where: { id: partnerId, weddingId }, select: { id: true } });
    if (!partner) throw new ValidationError('That guest is not on this wedding');
  }
  const pair = partnerId ? [guestId, partnerId] : [guestId];
  await tx.guest.updateMany({ where: { weddingId, pairedGuestId: { in: pair }, id: { notIn: pair } }, data: { pairedGuestId: null } });
  if (partnerId) await tx.guest.update({ where: { id: partnerId }, data: { pairedGuestId: guestId } });
  await tx.guest.update({ where: { id: guestId }, data: { pairedGuestId: partnerId } });
}

// Every query here is awaited before it is returned: a query handed back un-run could start outside the caller's business scope
// (seen 19 Nov 2026 in the real-database test: a venue's new guest was then "not found"). tests-db/guest.rsvp.test.ts.
export const guestService = {
  async listForAdmin(weddingId: string) {
    await assertWedding(weddingId);
    return await prisma.guest.findMany({ where: { weddingId }, include: guestInclude, orderBy: { name: 'asc' } });
  },

  async create(weddingId: string, input: GuestInput) {
    const wedding = await assertWedding(weddingId);
    const responses = checkFunctions(input, new Set(wedding.events.map((e) => e.id)));
    return await prisma.$transaction(async (tx) => {
      const guest = await tx.guest.create({ data: { ...normalize(input), weddingId, rsvpToken: randomUUID() } });
      if (responses.length) {
        await tx.guestFunctionResponse.createMany({
          data: responses.map((r) => ({ guestId: guest.id, weddingEventId: r.weddingEventId, status: r.status })),
          skipDuplicates: true,
        });
      }
      if (input.pairedGuestId) await setPartner(tx, weddingId, guest.id, input.pairedGuestId);
      return await tx.guest.findUniqueOrThrow({ where: { id: guest.id }, include: guestInclude });
    });
  },

  async update(weddingId: string, guestId: string, input: GuestInput) {
    const wedding = await assertWedding(weddingId);
    const guest = await prisma.guest.findFirst({ where: { id: guestId, weddingId }, select: { id: true, pairedGuestId: true } });
    if (!guest) throw new NotFoundError('Guest', guestId);
    const responses = checkFunctions(input, new Set(wedding.events.map((e) => e.id)));
    return await prisma.$transaction(async (tx) => {
      await tx.guest.update({ where: { id: guestId }, data: normalize(input) });
      await tx.guestFunctionResponse.deleteMany({ where: { guestId } });
      if (responses.length) {
        await tx.guestFunctionResponse.createMany({
          data: responses.map((r) => ({ guestId, weddingEventId: r.weddingEventId, status: r.status })),
        });
      }
      // Only touch the pairing when the editor sent it (an older client that leaves it out keeps it as it is).
      if (input.pairedGuestId !== undefined && (input.pairedGuestId ?? null) !== guest.pairedGuestId) {
        await setPartner(tx, weddingId, guestId, input.pairedGuestId ?? null);
      }
      return await tx.guest.findUniqueOrThrow({ where: { id: guestId }, include: guestInclude });
    });
  },

  async remove(weddingId: string, guestId: string) {
    // The partner's "comes with" link is cleared by the database (ON DELETE SET NULL).
    const result = await prisma.guest.deleteMany({ where: { id: guestId, weddingId } });
    if (!result.count) throw new NotFoundError('Guest', guestId);
  },

  async listForClient(weddingId: string, userId: string) {
    await assertOwnedWedding(weddingId, userId);
    return await prisma.guest.findMany({ where: { weddingId }, include: guestInclude, orderBy: { name: 'asc' } });
  },

  // What the guest's RSVP link shows: only the functions they are invited to.
  async getPublicByToken(token: string) {
    const guest = await prisma.guest.findUnique({
      where: { rsvpToken: token },
      select: {
        id: true, name: true, accompanyingGuests: true, rsvpStatus: true,
        functionResponses: { select: { weddingEventId: true, status: true } },
        wedding: {
          select: {
            weddingType: true, weddingNumber: true, primaryDate: true, city: true,
            couple: { select: { brideName: true, groomName: true } },
            events: { orderBy: { date: 'asc' }, select: { id: true, type: true, label: true, date: true, startTime: true, venueName: true, city: true } },
          },
        },
      },
    });
    if (!guest) return null;
    const invited = new Set(invitedEventIds(guest.functionResponses.map((r) => r.weddingEventId), guest.wedding.events.map((e) => e.id)));
    return { ...guest, wedding: { ...guest.wedding, events: guest.wedding.events.filter((e) => invited.has(e.id)) } };
  },

  // The guest's answer from their link. Only invited functions are saved, and their invitations are never removed.
  async submitPublic(token: string, input: { rsvpStatus: GuestRsvpStatus; accompanyingGuests: number; functionResponses: { weddingEventId: string; status: GuestRsvpStatus }[] }) {
    const guest = await prisma.guest.findUnique({
      where: { rsvpToken: token },
      select: { id: true, functionResponses: { select: { weddingEventId: true } }, wedding: { select: { events: { select: { id: true } } } } },
    });
    if (!guest) throw new NotFoundError('Guest', token);
    const allIds = guest.wedding.events.map((e) => e.id);
    if (input.functionResponses.some((r) => !allIds.includes(r.weddingEventId))) throw new ValidationError('A function does not belong to this wedding');
    const invited = invitedEventIds(guest.functionResponses.map((r) => r.weddingEventId), allIds);
    const answers = answersForInvited(input.functionResponses, invited);
    return await prisma.$transaction(async (tx) => {
      await tx.guest.update({ where: { id: guest.id }, data: { rsvpStatus: input.rsvpStatus, accompanyingGuests: Math.max(0, Math.floor(input.accompanyingGuests)) } });
      for (const a of answers) {
        await tx.guestFunctionResponse.upsert({
          where: { guestId_weddingEventId: { guestId: guest.id, weddingEventId: a.weddingEventId } },
          create: { guestId: guest.id, weddingEventId: a.weddingEventId, status: a.status },
          update: { status: a.status },
        });
      }
      return { success: true };
    });
  },
};

async function assertOwnedWedding(weddingId: string, userId: string) {
  const wedding = await prisma.wedding.findFirst({ where: { id: weddingId, customerId: userId }, select: { id: true } });
  if (!wedding) throw new NotFoundError('Wedding', weddingId);
  return wedding;
}
