import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { effectiveScope } from '@/lib/ownership/scope';
import { ownBusinessId } from '@/lib/ownership/business';
import { can } from '@/lib/auth/permissions';
import { isVenueCategory } from '@/lib/quotation/terms';
import { istDay } from '@/lib/venue/calendar';
import { hallLockKey } from './hallHold.service';
import {
  clashes,
  clashWords,
  DEFAULT_HOLD_DAYS,
  HOLD_DAYS,
  holdEnd,
  SHIFT_LABEL,
  slotOf,
  SPACE_LIMITS,
  TAKES_HALL,
  validateSlot,
  validateSpace,
  type Slot,
  type SlotEnquiry,
  type SlotErrors,
  type Space,
  type SpaceErrors,
} from '@/lib/venue/slots';

// Halls and shifts (lib/venue/slots.ts): a venue's halls and lawns, the hall + date + shift each of its enquiries reserves, and the
// shifts it blocks by hand. Always called inside the business's scope (lib/ownership/venueEntry.ts). VenueSpace and VenueSlot are
// not owned tables, so EVERY read and write here names the business of the current scope itself — never one from a request — and a
// row of another business is simply "not found". An enquiry is read through the database guard (Consultation is owned), so another
// business's enquiry is "not found" too, and a slot can only ever point at this business's own enquiry.
//
// The `can…` flags only tell the screens which buttons to show; the API routes enforce the same permissions (venueScoped).

export interface EnquirySlot extends Slot {
  clashes: Slot[]; // other enquiries or blocks on the same hall, date and shift — a warning, never a block
}

export interface EnquirySlots {
  usesHalls: boolean;
  canReserve: boolean; // may add or remove halls on an enquiry (quotations)
  spaces: Space[]; // every hall — the form offers only those in use; one taken out of use still names its old slots
  slots: EnquirySlot[];
}

export interface HallCalendar {
  usesHalls: boolean;
  canManage: boolean; // may add, rename or remove halls (settings)
  canBlock: boolean; // may block and free shifts (weddings or quotations)
  spaces: Space[]; // every hall, active first
  slots: Slot[];
  truncated: boolean; // more slots in these months than one answer carries — the latest are left out, and the screen says so
}

export type HallList = { usesHalls: boolean; canManage: boolean; spaces: Space[] };
export type SpacesResult = HallList | { errors: SpaceErrors };
export type ReserveResult = EnquirySlots | { errors: SlotErrors };

export interface VenueSpaceDeps {
  db: {
    venueSpace: Pick<typeof prisma.venueSpace, 'findMany' | 'findFirst' | 'count' | 'create' | 'updateMany' | 'deleteMany'>;
    venueSlot: Pick<typeof prisma.venueSlot, 'findMany' | 'findFirst' | 'count' | 'create' | 'updateMany' | 'deleteMany'>;
    consultation: Pick<typeof prisma.consultation, 'findUnique'>;
    business: Pick<typeof prisma.business, 'findUnique'>;
  };
  now: () => Date;
  // Runs fn while holding a database lock on one hall's date (a transaction-level advisory lock, the same as quotation numbers):
  // a hold and a block on the same hall and date check and save one after the other, never together. fn gets the database to use.
  lockHall: <T>(key: string, fn: (db: SlotDb) => Promise<T>) => Promise<T>;
}

export type SlotDb = Pick<VenueSpaceDeps['db'], 'venueSlot'>;

const defaultDeps = (): VenueSpaceDeps => ({
  db: prisma,
  now: () => new Date(),
  lockHall: (key, fn) =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
      return fn(tx);
    }),
});
const hallKey = hallLockKey; // the same key the acceptance check locks (services/hallHold.service.ts)

const SPACE_SELECT = { id: true, name: true, capacity: true, active: true } as const;
const ENQUIRY_SELECT = { id: true, name: true, pipelineStage: true, bookings: { select: { status: true, wedding: { select: { id: true, weddingNumber: true } } } } } as const;
const SLOT_SELECT = { id: true, spaceId: true, date: true, shift: true, note: true, holdUntil: true, consultation: { select: ENQUIRY_SELECT } } as const;
export const MAX_SLOTS_PER_ENQUIRY = 12;
export const MAX_CALENDAR_SLOTS = 3000;
const dayDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const isUniqueClash = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
const NAME_TAKEN: SpaceErrors = { name: 'You already have a hall or lawn with this name' };

export function createVenueSpaceService(deps: VenueSpaceDeps = defaultDeps()) {
  const businessId = ownBusinessId;

  async function spaces(id: string): Promise<Space[]> {
    return deps.db.venueSpace.findMany({ where: { businessId: id }, select: SPACE_SELECT, orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  // A venue (by its listing's category) works with halls; so does any business that has ever added one — in use or not.
  async function usesHalls(id: string, count: number): Promise<boolean> {
    if (count > 0) return true;
    const b = await deps.db.business.findUnique({ where: { id }, select: { vendor: { select: { category: { select: { name: true } } } } } });
    const category = b?.vendor?.category?.name;
    return !!category && isVenueCategory(category);
  }

  async function slotsWhere(id: string, where: Prisma.VenueSlotWhereInput, take: number, db: SlotDb = deps.db): Promise<{ slots: Slot[]; truncated: boolean }> {
    const rows = await db.venueSlot.findMany({ where: { ...where, businessId: id }, select: SLOT_SELECT, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }], take: take + 1 });
    const now = deps.now();
    return { slots: rows.slice(0, take).map((r) => slotOf(r, now)).filter((s): s is Slot => s !== null), truncated: rows.length > take };
  }

  async function enquiry(id: string): Promise<SlotEnquiry> {
    const row = await deps.db.consultation.findUnique({ where: { id }, select: ENQUIRY_SELECT });
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

  // The enquiry's halls and shifts, each with what else is on that hall then. `e` is the enquiry already read by the caller.
  async function slotsOf(id: string, e: SlotEnquiry): Promise<EnquirySlots> {
    const [list, rows] = await Promise.all([
      spaces(id),
      deps.db.venueSlot.findMany({ where: { businessId: id, consultationId: e.id }, select: SLOT_SELECT, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
    ]);
    // This enquiry's own slots always show here — as quoted when the enquiry is closed (they no longer take the hall anywhere else).
    const now = deps.now();
    const own = rows.map((r) => slotOf(r, now) ?? slotOf({ ...r, holdUntil: null, consultation: { ...e, pipelineStage: 'NEW', bookings: [] } }, now)!);
    const pairs = own.map((s) => ({ spaceId: s.spaceId, date: dayDate(s.date) }));
    // clashes() leaves out this enquiry's own slots. Not a SQL `NOT consultationId = …`: that would also drop the hand blocks (no enquiry).
    const around = pairs.length ? (await slotsWhere(id, { OR: pairs }, MAX_SLOTS_PER_ENQUIRY * 50)).slots : [];
    return {
      usesHalls: await usesHalls(id, list.length),
      canReserve: can(effectiveScope(), 'quotations'),
      spaces: list,
      slots: own.map((s) => ({ ...s, clashes: clashes(s, around) })),
    };
  }

  async function list(): Promise<HallList> {
    const id = businessId();
    const all = await spaces(id);
    return { usesHalls: await usesHalls(id, all.length), canManage: can(effectiveScope(), 'settings'), spaces: all };
  }

  return {
    // ---------- halls and lawns ----------

    list,

    async add(input: Record<string, unknown>): Promise<SpacesResult> {
      const id = businessId();
      const checked = validateSpace(input);
      if (!checked.ok) return { errors: checked.errors };
      if (await nameTaken(id, checked.value.name)) return { errors: NAME_TAKEN };
      const count = await deps.db.venueSpace.count({ where: { businessId: id } });
      if (count >= SPACE_LIMITS.maxSpaces) throw new ConflictError(`Please keep it to ${SPACE_LIMITS.maxSpaces} halls and lawns`);
      try {
        await deps.db.venueSpace.create({ data: { businessId: id, name: checked.value.name, capacity: checked.value.capacity, active: true, sortOrder: count } });
      } catch (err) {
        if (isUniqueClash(err)) return { errors: NAME_TAKEN };
        throw err;
      }
      return list();
    },

    // Only what is sent changes: a rename keeps the guest count and whether the hall is in use.
    async update(spaceId: string, input: Record<string, unknown>): Promise<SpacesResult> {
      const id = businessId();
      const current = await deps.db.venueSpace.findFirst({ where: { id: spaceId, businessId: id }, select: SPACE_SELECT });
      if (!current) throw new NotFoundError('Hall', spaceId);
      const checked = validateSpace({
        name: 'name' in input ? input.name : current.name,
        capacity: 'capacity' in input ? input.capacity : (current.capacity ?? ''),
        active: 'active' in input ? input.active : current.active,
      });
      if (!checked.ok) return { errors: checked.errors };
      if (await nameTaken(id, checked.value.name, spaceId)) return { errors: NAME_TAKEN };
      try {
        const { count } = await deps.db.venueSpace.updateMany({ where: { id: spaceId, businessId: id }, data: checked.value });
        if (count === 0) throw new NotFoundError('Hall', spaceId);
      } catch (err) {
        if (isUniqueClash(err)) return { errors: NAME_TAKEN };
        throw err;
      }
      return list();
    },

    // A hall with slots is kept (taken out of use, so its bookings still read right); one without any is deleted.
    async remove(spaceId: string): Promise<HallList> {
      const id = businessId();
      const used = await deps.db.venueSlot.count({ where: { businessId: id, spaceId } });
      const { count } = used > 0
        ? await deps.db.venueSpace.updateMany({ where: { id: spaceId, businessId: id }, data: { active: false } })
        : await deps.db.venueSpace.deleteMany({ where: { id: spaceId, businessId: id } });
      if (count === 0) throw new NotFoundError('Hall', spaceId);
      return list();
    },

    // ---------- an enquiry's halls and shifts ----------

    async forEnquiry(enquiryId: string): Promise<EnquirySlots> {
      const id = businessId();
      return slotsOf(id, await enquiry(enquiryId));
    },

    // Reserve a hall + date + shift for this enquiry. A clash with another couple or a block is shown as a warning, never refused:
    // two couples can be quoted for one hall, and only one will accept. The same hall, date and shift twice is kept once — also when
    // two taps arrive together (the database's unique index on hall + date + shift + enquiry).
    async reserve(enquiryId: string, input: Record<string, unknown>, actorId: string | null): Promise<ReserveResult> {
      const id = businessId();
      const e = await enquiry(enquiryId);
      if (e.pipelineStage === 'LOST') throw new ConflictError('This enquiry is closed');
      const checked = validateSlot(input, istDay(deps.now()));
      if (!checked.ok) return { errors: checked.errors };
      const v = checked.value;
      await activeSpace(id, v.spaceId);
      const mine = await deps.db.venueSlot.findMany({ where: { businessId: id, consultationId: e.id }, select: { spaceId: true, date: true, shift: true } });
      if (mine.some((s) => s.spaceId === v.spaceId && s.date.toISOString().slice(0, 10) === v.date && s.shift === v.shift)) return slotsOf(id, e);
      if (mine.length >= MAX_SLOTS_PER_ENQUIRY) throw new ConflictError(`Please keep it to ${MAX_SLOTS_PER_ENQUIRY} halls and shifts on one enquiry`);
      try {
        await deps.db.venueSlot.create({ data: { businessId: id, spaceId: v.spaceId, date: dayDate(v.date), shift: v.shift, consultationId: e.id, createdById: actorId } });
      } catch (err) {
        if (!isUniqueClash(err)) throw err; // a second tap that arrived together: the first one saved it
      }
      return slotsOf(id, e);
    },

    // Hold this enquiry's hall for the couple for `days` (to the end of that day in India), or extend a hold. While held it takes the
    // hall: nobody can block or hold it over the hold, and no other couple can accept a quotation for it (founder, option B —
    // services/hallHold.service.ts). Refused when the hall is already booked, accepted, held or blocked for that shift by anyone else,
    // and for a slot whose date has passed. The check and the save run under the hall's lock. The hold ends by itself.
    async hold(enquiryId: string, slotId: string, input: { days?: unknown }, actorId: string | null): Promise<EnquirySlots> {
      const id = businessId();
      const e = await enquiry(enquiryId);
      if (e.pipelineStage === 'LOST') throw new ConflictError('This enquiry is closed');
      const days = Number(input.days ?? DEFAULT_HOLD_DAYS);
      if (!(HOLD_DAYS as readonly number[]).includes(days)) throw new ValidationError(`Choose how long to hold it: ${HOLD_DAYS.join(', ')} days`);
      const row = await deps.db.venueSlot.findFirst({ where: { id: slotId, businessId: id, consultationId: e.id }, select: SLOT_SELECT });
      if (!row) throw new NotFoundError('Hall and shift', slotId);
      const now = deps.now();
      const slot = slotOf(row, now);
      if (!slot) throw new ConflictError('This couple’s booking was closed — the hall cannot be held for them');
      if (slot.state !== 'QUOTED' && slot.state !== 'HELD') throw new ConflictError('The couple has already accepted — the hall is theirs through the booking, not a hold');
      if (slot.date < istDay(now)) throw new ConflictError('This date has passed');
      await deps.lockHall(hallKey(slot.spaceId, slot.date), async (db) => {
        // The hall and what else is on it that day are read together.
        const [space, found] = await Promise.all([
          deps.db.venueSpace.findFirst({ where: { id: slot.spaceId, businessId: id }, select: SPACE_SELECT }),
          slotsWhere(id, { spaceId: slot.spaceId, date: dayDate(slot.date) }, 500, db),
        ]);
        if (!space?.active) throw new ConflictError('This hall is no longer in use');
        const around = found.slots;
        const taken = clashes(slot, around).filter((c) => TAKES_HALL.includes(c.state));
        if (taken.length) throw new ConflictError(`${space.name} is not free for ${SHIFT_LABEL[slot.shift].toLowerCase()} on that date: ${clashWords(taken[0])}`);
        await db.venueSlot.updateMany({ where: { id: slotId, businessId: id, consultationId: e.id }, data: { holdUntil: holdEnd(now, days, slot.date), heldById: actorId } });
      });
      return slotsOf(id, e);
    },

    // End a hold now — the hall goes back to quoted for this couple.
    async releaseHold(enquiryId: string, slotId: string): Promise<EnquirySlots> {
      const id = businessId();
      const e = await enquiry(enquiryId);
      const { count } = await deps.db.venueSlot.updateMany({ where: { id: slotId, businessId: id, consultationId: e.id }, data: { holdUntil: null, heldById: null } });
      if (count === 0) throw new NotFoundError('Hall and shift', slotId);
      return slotsOf(id, e);
    },

    async release(enquiryId: string, slotId: string): Promise<EnquirySlots> {
      const id = businessId();
      const e = await enquiry(enquiryId);
      const { count } = await deps.db.venueSlot.deleteMany({ where: { id: slotId, businessId: id, consultationId: e.id } });
      if (count === 0) throw new NotFoundError('Hall and shift', slotId);
      return slotsOf(id, e);
    },

    // ---------- the calendar ----------

    async calendar(range: { gte: Date; lt: Date }): Promise<HallCalendar> {
      const id = businessId();
      const scope = effectiveScope();
      const [all, found] = await Promise.all([spaces(id), slotsWhere(id, { date: range }, MAX_CALENDAR_SLOTS)]);
      return {
        usesHalls: await usesHalls(id, all.length),
        canManage: can(scope, 'settings'),
        canBlock: can(scope, 'weddings') || can(scope, 'quotations'),
        spaces: all,
        slots: all.length ? found.slots : [],
        truncated: found.truncated,
      };
    },

    // Block a hall's shift by hand (repairs, the owner's own function …). Refused over a shift that is already booked, accepted or
    // blocked — a quote alone does not stop it (the couple has not said yes). The check and the save run under the hall's lock.
    async block(input: Record<string, unknown>, actorId: string | null): Promise<Slot | { errors: SlotErrors }> {
      const id = businessId();
      const checked = validateSlot(input, istDay(deps.now()));
      if (!checked.ok) return { errors: checked.errors };
      const v = checked.value;
      const space = await activeSpace(id, v.spaceId);
      const row = await deps.lockHall(hallKey(v.spaceId, v.date), async (db) => {
        const around = (await slotsWhere(id, { spaceId: v.spaceId, date: dayDate(v.date) }, 500, db)).slots;
        const taken = clashes({ id: '', spaceId: v.spaceId, date: v.date, shift: v.shift, enquiryId: null }, around).filter((c) => TAKES_HALL.includes(c.state));
        if (taken.length) throw new ConflictError(`${space.name} is not free for ${SHIFT_LABEL[v.shift].toLowerCase()} on that date: ${clashWords(taken[0])}`);
        return db.venueSlot.create({ data: { businessId: id, spaceId: v.spaceId, date: dayDate(v.date), shift: v.shift, note: v.note, consultationId: null, createdById: actorId }, select: SLOT_SELECT });
      });
      return slotOf(row, deps.now())!;
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
