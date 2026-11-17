import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { effectiveScope } from '@/lib/ownership/scope';
import { can } from '@/lib/auth/permissions';
import { PLATFORM_BUSINESS_ID } from '@/lib/ownership/owned';
import { isVenueCategory } from '@/lib/quotation/terms';
import { istDay } from '@/lib/venue/calendar';
import {
  clashes,
  clashWords,
  SHIFT_LABEL,
  slotOf,
  SPACE_LIMITS,
  TAKES_HALL,
  validateSlot,
  validateSpace,
  type Slot,
  type SlotErrors,
  type Space,
  type SpaceErrors,
} from '@/lib/venue/slots';

// Halls and shifts (lib/venue/slots.ts): a venue's halls and lawns, the hall + date + shift each of its enquiries reserves, and the
// shifts it blocks by hand. Always called inside the business's scope (lib/ownership/venueEntry.ts). VenueSpace and VenueSlot are
// not owned tables, so EVERY read and write here names the business of the current scope itself — never one from a request — and a
// row of another business is simply "not found". An enquiry is read through the database guard (Consultation is owned), so another
// business's enquiry is "not found" too, and a slot can only ever point at this business's own enquiry.

export interface EnquirySlot extends Slot {
  clashes: Slot[]; // other enquiries or blocks on the same hall, date and shift — a warning, never a block
}

export interface EnquirySlots {
  usesHalls: boolean;
  spaces: Space[]; // the halls that can be chosen (active only)
  slots: EnquirySlot[];
}

export interface HallCalendar {
  usesHalls: boolean;
  canManage: boolean; // may add, rename or remove halls (the settings permission) — the screen hides those buttons otherwise
  spaces: Space[]; // every hall, active first — a hall taken out of use still names its old slots
  slots: Slot[];
}

export type HallList = { usesHalls: boolean; canManage: boolean; spaces: Space[] };
export type SpacesResult = HallList | { errors: SpaceErrors };
export type ReserveResult = EnquirySlots | { errors: SlotErrors };

export interface VenueSpaceDeps {
  db: {
    venueSpace: Pick<typeof prisma.venueSpace, 'findMany' | 'findFirst' | 'count' | 'create' | 'updateMany' | 'deleteMany'>;
    venueSlot: Pick<typeof prisma.venueSlot, 'findMany' | 'count' | 'create' | 'deleteMany'>;
    consultation: Pick<typeof prisma.consultation, 'findUnique'>;
    business: Pick<typeof prisma.business, 'findUnique'>;
  };
  now: () => Date;
}

const defaultDeps = (): VenueSpaceDeps => ({ db: prisma, now: () => new Date() });

const SPACE_SELECT = { id: true, name: true, capacity: true, active: true } as const;
const SLOT_SELECT = {
  id: true,
  spaceId: true,
  date: true,
  shift: true,
  note: true,
  consultation: { select: { id: true, name: true, pipelineStage: true, bookings: { select: { status: true, wedding: { select: { id: true, weddingNumber: true } } } } } },
} as const;
export const MAX_SLOTS_PER_ENQUIRY = 12;
const dayDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const isUniqueClash = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

export function createVenueSpaceService(deps: VenueSpaceDeps = defaultDeps()) {
  function businessId(): string {
    const scope = effectiveScope();
    if (scope.kind !== 'BUSINESS' || scope.businessId === PLATFORM_BUSINESS_ID) throw new NotFoundError('Business', 'current');
    return scope.businessId;
  }

  async function spaces(id: string, activeOnly = false): Promise<Space[]> {
    return deps.db.venueSpace.findMany({ where: { businessId: id, ...(activeOnly ? { active: true } : {}) }, select: SPACE_SELECT, orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  // A venue (by its listing's category) works with halls; so does any business that has added one.
  async function usesHalls(id: string, count: number): Promise<boolean> {
    if (count > 0) return true;
    const b = await deps.db.business.findUnique({ where: { id }, select: { vendor: { select: { category: { select: { name: true } } } } } });
    const category = b?.vendor?.category?.name;
    return !!category && isVenueCategory(category);
  }

  async function slotsWhere(id: string, where: Prisma.VenueSlotWhereInput): Promise<Slot[]> {
    const rows = await deps.db.venueSlot.findMany({ where: { ...where, businessId: id }, select: SLOT_SELECT, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }], take: 2000 });
    return rows.map((r) => slotOf(r)).filter((s): s is Slot => s !== null);
  }

  async function enquiry(id: string) {
    const row = await deps.db.consultation.findUnique({ where: { id }, select: { id: true, name: true, pipelineStage: true, bookings: { select: { status: true, wedding: { select: { id: true, weddingNumber: true } } } } } });
    if (!row) throw new NotFoundError('Enquiry', id);
    return row;
  }

  // "Royal Hall" and "royal hall" are the same hall — the database's unique name is case-sensitive, so this check is the one that counts.
  async function nameTaken(id: string, name: string, except?: string): Promise<boolean> {
    const hit = await deps.db.venueSpace.findFirst({ where: { businessId: id, name: { equals: name, mode: 'insensitive' }, ...(except ? { NOT: { id: except } } : {}) }, select: { id: true } });
    return !!hit;
  }

  async function activeSpace(id: string, spaceId: string) {
    const space = await deps.db.venueSpace.findFirst({ where: { id: spaceId, businessId: id, active: true }, select: SPACE_SELECT });
    if (!space) throw new ValidationError('Choose one of your halls or lawns');
    return space;
  }

  async function forEnquiry(enquiryId: string): Promise<EnquirySlots> {
    const id = businessId();
    const e = await enquiry(enquiryId);
    const list = await spaces(id, true);
    const rows = await deps.db.venueSlot.findMany({ where: { businessId: id, consultationId: e.id }, select: SLOT_SELECT, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] });
    // This enquiry's own slots always show here — as quoted when the enquiry is closed (they no longer take the hall anywhere else).
    const own = rows.map((r) => slotOf(r) ?? slotOf({ ...r, consultation: { ...e, pipelineStage: 'NEW', bookings: [] } })!);
    const pairs = own.map((s) => ({ spaceId: s.spaceId, date: dayDate(s.date) }));
    // clashes() leaves out this enquiry's own slots. Not a SQL `NOT consultationId = …`: that would also drop the hand blocks (no enquiry).
    const around = pairs.length ? await slotsWhere(id, { OR: pairs }) : [];
    return {
      usesHalls: await usesHalls(id, list.length),
      spaces: list,
      slots: own.map((s) => ({ ...s, clashes: clashes(s, around) })),
    };
  }

  return {
    // ---------- halls and lawns ----------

    async list(): Promise<HallList> {
      const id = businessId();
      const list = await spaces(id);
      return { usesHalls: await usesHalls(id, list.length), canManage: can(effectiveScope(), 'settings'), spaces: list };
    },

    async add(input: Record<string, unknown>): Promise<SpacesResult> {
      const id = businessId();
      const checked = validateSpace(input);
      if (!checked.ok) return { errors: checked.errors };
      if (await nameTaken(id, checked.value.name)) return { errors: { name: 'You already have a hall or lawn with this name' } };
      if ((await deps.db.venueSpace.count({ where: { businessId: id } })) >= SPACE_LIMITS.maxSpaces) throw new ConflictError(`Please keep it to ${SPACE_LIMITS.maxSpaces} halls and lawns`);
      try {
        await deps.db.venueSpace.create({ data: { businessId: id, name: checked.value.name, capacity: checked.value.capacity, active: true, sortOrder: await deps.db.venueSpace.count({ where: { businessId: id } }) } });
      } catch (err) {
        if (isUniqueClash(err)) return { errors: { name: 'You already have a hall or lawn with this name' } };
        throw err;
      }
      return this.list();
    },

    async update(spaceId: string, input: Record<string, unknown>): Promise<SpacesResult> {
      const id = businessId();
      const checked = validateSpace(input);
      if (!checked.ok) return { errors: checked.errors };
      if (await nameTaken(id, checked.value.name, spaceId)) return { errors: { name: 'You already have a hall or lawn with this name' } };
      try {
        const { count } = await deps.db.venueSpace.updateMany({ where: { id: spaceId, businessId: id }, data: checked.value });
        if (count === 0) throw new NotFoundError('Hall', spaceId);
      } catch (err) {
        if (isUniqueClash(err)) return { errors: { name: 'You already have a hall or lawn with this name' } };
        throw err;
      }
      return this.list();
    },

    // A hall with slots is kept (taken out of use, so its bookings still read right); one without any is deleted.
    async remove(spaceId: string): Promise<HallList> {
      const id = businessId();
      const used = await deps.db.venueSlot.count({ where: { businessId: id, spaceId } });
      const { count } = used > 0
        ? await deps.db.venueSpace.updateMany({ where: { id: spaceId, businessId: id }, data: { active: false } })
        : await deps.db.venueSpace.deleteMany({ where: { id: spaceId, businessId: id } });
      if (count === 0) throw new NotFoundError('Hall', spaceId);
      return this.list();
    },

    // ---------- an enquiry's halls and shifts ----------

    forEnquiry,

    // Reserve a hall + date + shift for this enquiry. A clash with another couple or a block is shown as a warning, never refused:
    // two couples can be quoted for one hall, and only one will accept.
    async reserve(enquiryId: string, input: Record<string, unknown>, actorId: string | null): Promise<ReserveResult> {
      const id = businessId();
      const e = await enquiry(enquiryId);
      if (e.pipelineStage === 'LOST') throw new ConflictError('This enquiry is closed');
      const checked = validateSlot(input, istDay(deps.now()));
      if (!checked.ok) return { errors: checked.errors };
      const v = checked.value;
      await activeSpace(id, v.spaceId);
      const mine = await deps.db.venueSlot.findMany({ where: { businessId: id, consultationId: e.id }, select: { spaceId: true, date: true, shift: true } });
      if (mine.some((s) => s.spaceId === v.spaceId && s.date.toISOString().slice(0, 10) === v.date && s.shift === v.shift)) return forEnquiry(enquiryId);
      if (mine.length >= MAX_SLOTS_PER_ENQUIRY) throw new ConflictError(`Please keep it to ${MAX_SLOTS_PER_ENQUIRY} halls and shifts on one enquiry`);
      await deps.db.venueSlot.create({ data: { businessId: id, spaceId: v.spaceId, date: dayDate(v.date), shift: v.shift, consultationId: e.id, createdById: actorId } });
      return forEnquiry(enquiryId);
    },

    async release(enquiryId: string, slotId: string): Promise<EnquirySlots> {
      const id = businessId();
      const e = await enquiry(enquiryId);
      const { count } = await deps.db.venueSlot.deleteMany({ where: { id: slotId, businessId: id, consultationId: e.id } });
      if (count === 0) throw new NotFoundError('Hall and shift', slotId);
      return forEnquiry(enquiryId);
    },

    // ---------- the calendar ----------

    async calendar(range: { gte: Date; lt: Date }): Promise<HallCalendar> {
      const id = businessId();
      const list = await spaces(id);
      return { usesHalls: await usesHalls(id, list.length), canManage: can(effectiveScope(), 'settings'), spaces: list, slots: list.length ? await slotsWhere(id, { date: range }) : [] };
    },

    // Block a hall's shift by hand (repairs, the owner's own function …). Refused over a shift that is already booked, accepted or
    // blocked — a quote alone does not stop it (the couple has not said yes).
    async block(input: Record<string, unknown>, actorId: string | null): Promise<Slot | { errors: SlotErrors }> {
      const id = businessId();
      const checked = validateSlot(input, istDay(deps.now()));
      if (!checked.ok) return { errors: checked.errors };
      const v = checked.value;
      const space = await activeSpace(id, v.spaceId);
      const around = await slotsWhere(id, { spaceId: v.spaceId, date: dayDate(v.date) });
      const taken = clashes({ id: '', spaceId: v.spaceId, date: v.date, shift: v.shift, enquiryId: null }, around).filter((c) => TAKES_HALL.includes(c.state));
      if (taken.length) throw new ConflictError(`${space.name} is not free for ${SHIFT_LABEL[v.shift].toLowerCase()} on that date: ${clashWords(taken[0])}`);
      const row = await deps.db.venueSlot.create({ data: { businessId: id, spaceId: v.spaceId, date: dayDate(v.date), shift: v.shift, note: v.note, consultationId: null, createdById: actorId }, select: SLOT_SELECT });
      return slotOf(row)!;
    },

    async unblock(slotId: string): Promise<{ removed: true }> {
      const id = businessId();
      const { count } = await deps.db.venueSlot.deleteMany({ where: { id: slotId, businessId: id, consultationId: null } });
      if (count === 0) throw new NotFoundError('Blocked shift', slotId);
      return { removed: true };
    },
  };
}

export const venueSpaceService = createVenueSpaceService();
