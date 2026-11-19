import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { GuestRsvpStatus } from '@/generated/prisma/enums';

export type GuestInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  category?: string | null;
  accompanyingGuests?: number;
  rsvpStatus?: GuestRsvpStatus;
  notes?: string | null;
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

function normalize(input: GuestInput) {
  return {
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    category: input.category?.trim() || null,
    accompanyingGuests: Math.max(0, Math.floor(input.accompanyingGuests ?? 0)),
    rsvpStatus: input.rsvpStatus ?? GuestRsvpStatus.PENDING,
    notes: input.notes?.trim() || null,
  };
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
    const responses = input.functionResponses ?? [];
    const eventIds = new Set(wedding.events.map((event) => event.id));
    if (responses.some((response) => !eventIds.has(response.weddingEventId))) throw new Error('Function does not belong to this event');
    return await prisma.$transaction(async (tx) => {
      const guest = await tx.guest.create({ data: { ...normalize(input), weddingId, rsvpToken: randomUUID() } });
      if (responses.length) {
        await tx.guestFunctionResponse.createMany({
          data: responses.map((response) => ({ guestId: guest.id, weddingEventId: response.weddingEventId, status: response.status })),
          skipDuplicates: true,
        });
      }
      return await tx.guest.findUniqueOrThrow({ where: { id: guest.id }, include: guestInclude });
    });
  },

  async update(weddingId: string, guestId: string, input: GuestInput) {
    const wedding = await assertWedding(weddingId);
    const guest = await prisma.guest.findFirst({ where: { id: guestId, weddingId } });
    if (!guest) throw new NotFoundError('Guest', guestId);
    const responses = input.functionResponses ?? [];
    const eventIds = new Set(wedding.events.map((event) => event.id));
    if (responses.some((response) => !eventIds.has(response.weddingEventId))) throw new Error('Function does not belong to this event');
    return await prisma.$transaction(async (tx) => {
      await tx.guest.update({ where: { id: guestId }, data: normalize(input) });
      await tx.guestFunctionResponse.deleteMany({ where: { guestId } });
      if (responses.length) {
        await tx.guestFunctionResponse.createMany({
          data: responses.map((response) => ({ guestId, weddingEventId: response.weddingEventId, status: response.status })),
        });
      }
      return await tx.guest.findUniqueOrThrow({ where: { id: guestId }, include: guestInclude });
    });
  },

  async remove(weddingId: string, guestId: string) {
    const result = await prisma.guest.deleteMany({ where: { id: guestId, weddingId } });
    if (!result.count) throw new NotFoundError('Guest', guestId);
  },

  async listForClient(weddingId: string, userId: string) {
    await assertOwnedWedding(weddingId, userId);
    return await prisma.guest.findMany({ where: { weddingId }, include: guestInclude, orderBy: { name: 'asc' } });
  },

  async getPublicByToken(token: string) {
    return await prisma.guest.findUnique({
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
  },

  async submitPublic(token: string, input: { rsvpStatus: GuestRsvpStatus; accompanyingGuests: number; functionResponses: { weddingEventId: string; status: GuestRsvpStatus }[] }) {
    const guest = await prisma.guest.findUnique({ where: { rsvpToken: token }, select: { id: true, wedding: { select: { events: { select: { id: true } } } } } });
    if (!guest) throw new NotFoundError('Guest', token);
    const eventIds = new Set(guest.wedding.events.map((event) => event.id));
    if (input.functionResponses.some((response) => !eventIds.has(response.weddingEventId))) throw new Error('Function does not belong to this event');
    return await prisma.$transaction(async (tx) => {
      await tx.guest.update({ where: { id: guest.id }, data: { rsvpStatus: input.rsvpStatus, accompanyingGuests: Math.max(0, Math.floor(input.accompanyingGuests)) } });
      await tx.guestFunctionResponse.deleteMany({ where: { guestId: guest.id } });
      if (input.functionResponses.length) {
        await tx.guestFunctionResponse.createMany({ data: input.functionResponses.map((response) => ({ guestId: guest.id, weddingEventId: response.weddingEventId, status: response.status })) });
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
