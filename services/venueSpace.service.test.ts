import { describe, expect, it, mock } from 'bun:test';
import { runInScope } from '@/lib/ownership/scope';
import type { VenueSpaceDeps } from './venueSpace.service';

mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createVenueSpaceService } = await import('./venueSpace.service');

// Halls and shifts: every read and write names the current business; a clash on an enquiry is a warning; a hand block over a
// booked shift is refused. A fake database keeps rows in memory and applies the `where` fields this service uses.

type SpaceRow = { id: string; businessId: string; name: string; capacity: number | null; active: boolean; sortOrder: number; createdAt: Date };
type SlotRow = { id: string; businessId: string; spaceId: string; date: Date; shift: string; consultationId: string | null; note: string | null; holdUntil?: Date | null; heldById?: string | null; createdAt: Date };
type Enquiry = { id: string; businessId: string; name: string; pipelineStage: string; bookings: { status: string; wedding: null }[] };

const BIZ = 'venue-1';
const scope = { kind: 'BUSINESS' as const, businessId: BIZ, role: 'OWNER' as const };
const run = <T,>(fn: () => Promise<T>) => runInScope(scope, fn);

function fake() {
  const spaces: SpaceRow[] = [
    { id: 'hall', businessId: BIZ, name: 'Royal Hall', capacity: 500, active: true, sortOrder: 0, createdAt: new Date(1) },
    { id: 'other-hall', businessId: 'venue-2', name: 'Their Hall', capacity: null, active: true, sortOrder: 0, createdAt: new Date(1) },
  ];
  const slots: SlotRow[] = [];
  const locks: string[] = [];
  const enquiries: Enquiry[] = [
    { id: 'e1', businessId: BIZ, name: 'Riya & Aman', pipelineStage: 'QUOTATION_SENT', bookings: [] },
    { id: 'e2', businessId: BIZ, name: 'Neha & Raj', pipelineStage: 'WON', bookings: [{ status: 'CONFIRMED', wedding: null }] },
    { id: 'lost', businessId: BIZ, name: 'Gone', pipelineStage: 'LOST', bookings: [] },
    { id: 'e3', businessId: BIZ, name: 'Pooja & Dev', pipelineStage: 'NEW', bookings: [] },
    { id: 'e4', businessId: BIZ, name: 'Closed Booking', pipelineStage: 'NEGOTIATION', bookings: [{ status: 'CLOSED', wedding: null }] },
  ];
  let n = 0;
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const matchSlot = (s: SlotRow, w: Record<string, unknown>): boolean => {
    if (w.businessId !== undefined && s.businessId !== w.businessId) return false;
    if (w.id !== undefined && s.id !== w.id) return false;
    if (w.spaceId !== undefined && s.spaceId !== w.spaceId) return false;
    if ('consultationId' in w && s.consultationId !== w.consultationId) return false;
    if (w.date instanceof Date && day(s.date) !== day(w.date)) return false;
    if (w.date && !(w.date instanceof Date)) {
      const r = w.date as { gte: Date; lt: Date };
      if (s.date < r.gte || s.date >= r.lt) return false;
    }
    if (w.OR && !(w.OR as Record<string, unknown>[]).some((o) => matchSlot(s, o))) return false;
    if (w.NOT) { const not = w.NOT as Record<string, unknown>; if ('consultationId' in not && s.consultationId === null) return false; if (matchSlot(s, not)) return false; }
    return true;
  };
  const withEnquiry = (s: SlotRow) => {
    const e = enquiries.find((x) => x.id === s.consultationId) ?? null;
    return { id: s.id, spaceId: s.spaceId, date: s.date, shift: s.shift, note: s.note, holdUntil: s.holdUntil ?? null, consultation: e ? { id: e.id, name: e.name, pipelineStage: e.pipelineStage, bookings: e.bookings } : null };
  };
  const matchSpace = (s: SpaceRow, w: Record<string, unknown>): boolean =>
    s.businessId === w.businessId &&
    (w.id === undefined || s.id === w.id) &&
    (w.active === undefined || s.active === w.active) &&
    (w.name === undefined || s.name.toLowerCase() === String((w.name as { equals: string }).equals).toLowerCase()) &&
    (w.NOT === undefined || s.id !== (w.NOT as { id: string }).id);
  const db = {
    venueSpace: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => spaces.filter((s) => matchSpace(s, where)),
      findFirst: async ({ where }: { where: Record<string, unknown> }) => spaces.find((s) => matchSpace(s, where)) ?? null,
      count: async ({ where }: { where: Record<string, unknown> }) => spaces.filter((s) => matchSpace(s, where)).length,
      create: async ({ data }: { data: Omit<SpaceRow, 'id' | 'createdAt'> }) => {
        const row = { ...data, id: `sp${++n}`, createdAt: new Date() } as SpaceRow;
        spaces.push(row);
        return row;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<SpaceRow> }) => {
        const hit = spaces.filter((s) => matchSpace(s, where));
        hit.forEach((s) => Object.assign(s, data));
        return { count: hit.length };
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const before = spaces.length;
        for (let i = spaces.length - 1; i >= 0; i--) if (matchSpace(spaces[i], where)) spaces.splice(i, 1);
        return { count: before - spaces.length };
      },
    },
    venueSlot: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => slots.filter((s) => matchSlot(s, where)).map(withEnquiry),
      count: async ({ where }: { where: Record<string, unknown> }) => slots.filter((s) => matchSlot(s, where)).length,
      findFirst: async ({ where }: { where: Record<string, unknown> }) => { const s = slots.find((x) => matchSlot(x, where)); return s ? withEnquiry(s) : null; },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<SlotRow> }) => {
        const hit = slots.filter((s) => matchSlot(s, where));
        hit.forEach((s) => Object.assign(s, data));
        return { count: hit.length };
      },
      create: async ({ data }: { data: Omit<SlotRow, 'id' | 'createdAt' | 'note' | 'consultationId'> & { note?: string | null; consultationId?: string | null } }) => {
        const row: SlotRow = { note: null, consultationId: null, ...data, id: `sl${++n}`, createdAt: new Date() } as SlotRow;
        slots.push(row);
        return withEnquiry(row);
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const before = slots.length;
        for (let i = slots.length - 1; i >= 0; i--) if (matchSlot(slots[i], where)) slots.splice(i, 1);
        return { count: before - slots.length };
      },
    },
    // The database guard limits enquiries to the scope's business; the fake does the same.
    consultation: { findUnique: async ({ where }: { where: { id: string } }) => enquiries.find((e) => e.id === where.id && e.businessId === BIZ) ?? null },
    business: { findUnique: async () => ({ vendor: { category: { name: 'Banquet Halls' } } }) },
  };
  const service = createVenueSpaceService({
    db: db as unknown as VenueSpaceDeps['db'],
    now: () => new Date('2026-11-17T06:00:00Z'),
    lockHall: (key, fn) => {
      locks.push(key);
      return fn(db as unknown as VenueSpaceDeps['db']);
    },
  });
  return { service, spaces, slots, locks };
}

describe('venueSpaceService', () => {
  it('lists only this business’s halls', async () => {
    const { service } = fake();
    const res = await run(() => service.list());
    expect(res.usesHalls).toBe(true);
    expect(res.spaces.map((s) => s.id)).toEqual(['hall']);
  });

  it('a hall needs a name', async () => {
    const { service } = fake();
    const res = await run(() => service.add({ name: '' }));
    expect(res).toEqual({ errors: { name: 'Give the hall or lawn a name' } });
  });

  it('a name already used, in any case, is a field error; renaming a hall to its own name is fine', async () => {
    const { service } = fake();
    expect(await run(() => service.add({ name: 'ROYAL hall' }))).toEqual({ errors: { name: 'You already have a hall or lawn with this name' } });
    const same = await run(() => service.update('hall', { name: 'Royal Hall', capacity: '600' }));
    expect('errors' in same).toBe(false);
    // another business may use the same name
    expect('errors' in (await run(() => service.add({ name: 'Their Hall' })))).toBe(false);
  });

  it('a rename keeps the guest count and whether the hall is in use', async () => {
    const { service, spaces } = fake();
    await run(() => service.update('hall', { active: false }));
    expect(spaces[0]).toMatchObject({ name: 'Royal Hall', capacity: 500, active: false });
    await run(() => service.update('hall', { name: 'Grand Hall' }));
    expect(spaces[0]).toMatchObject({ name: 'Grand Hall', capacity: 500, active: false });
    await run(() => service.update('hall', { capacity: '' }));
    expect(spaces[0].capacity).toBeNull();
  });

  it('an enquiry still sees its hall after the hall is taken out of use, and cannot choose it again', async () => {
    const { service } = fake();
    await run(() => service.reserve('e2', { spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT' }, null));
    await run(() => service.remove('hall'));
    const res = await run(() => service.forEnquiry('e2'));
    expect(res.usesHalls).toBe(true);
    expect(res.slots.map((s) => s.state)).toEqual(['BOOKED']);
    expect(res.spaces.find((s) => s.id === 'hall')?.active).toBe(false);
    await expect(run(() => service.reserve('e1', { spaceId: 'hall', date: '2026-12-13', shift: 'DAY' }, null))).rejects.toThrow('Choose one of your halls or lawns');
    const cal = await run(() => service.calendar({ gte: new Date('2026-11-01T00:00:00Z'), lt: new Date('2027-11-01T00:00:00Z') }));
    expect(cal.slots).toHaveLength(1);
  });

  it('says what the person may do', async () => {
    const { service } = fake();
    const staff = { kind: 'BUSINESS' as const, businessId: BIZ, role: 'MANAGER' as const, permissions: ['enquiries' as const] };
    const cal = await runInScope(staff, () => service.calendar({ gte: new Date('2026-11-01T00:00:00Z'), lt: new Date('2027-11-01T00:00:00Z') }));
    expect([cal.canManage, cal.canBlock]).toEqual([false, false]);
    expect((await runInScope(staff, () => service.forEnquiry('e1'))).canReserve).toBe(false);
    const owner = await run(() => service.calendar({ gte: new Date('2026-11-01T00:00:00Z'), lt: new Date('2027-11-01T00:00:00Z') }));
    expect([owner.canManage, owner.canBlock, owner.truncated]).toEqual([true, true, false]);
  });

  it('holds a quoted hall: it takes the hall, can be extended, refuses others, and ends by itself', async () => {
    const { service, slots } = fake();
    const r = await run(() => service.reserve('e1', { spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT' }, 'u'));
    if ('errors' in r) throw new Error('unexpected');
    const held = await run(() => service.hold('e1', r.slots[0].id, { days: 3 }, 'u'));
    expect([held.slots[0].state, held.slots[0].holdUntil]).toEqual(['HELD', '2026-11-20T18:29:59.999Z']);
    // nobody can block over the hold
    await expect(run(() => service.block({ spaceId: 'hall', date: '2026-12-12', shift: 'FULL_DAY' }, null))).rejects.toThrow('Royal Hall is not free');
    // another couple can still be quoted (a warning) but cannot hold it
    const other = await run(() => service.reserve('e3', { spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT' }, 'u'));
    if ('errors' in other) throw new Error('unexpected');
    expect(other.slots[0].clashes.map((c) => c.state)).toEqual(['HELD']);
    await expect(run(() => service.hold('e3', other.slots[0].id, { days: 1 }, 'u'))).rejects.toThrow('Royal Hall is not free');
    // extend: a new end
    const ext = await run(() => service.hold('e1', r.slots[0].id, { days: 7 }, 'u'));
    expect(ext.slots[0].holdUntil).toBe('2026-11-24T18:29:59.999Z');
    // the time passes: quoted again, the end remembered
    slots[0].holdUntil = new Date('2026-11-17T05:00:00Z');
    const after = await run(() => service.forEnquiry('e1'));
    expect([after.slots[0].state, after.slots[0].holdUntil]).toEqual(['QUOTED', '2026-11-17T05:00:00.000Z']);
  });

  it('holds and blocks check and save under the hall’s lock', async () => {
    const { service, locks } = fake();
    const r = await run(() => service.reserve('e1', { spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT' }, 'u'));
    if ('errors' in r) throw new Error('unexpected');
    await run(() => service.hold('e1', r.slots[0].id, { days: 1 }, 'u'));
    await run(() => service.block({ spaceId: 'hall', date: '2026-12-13', shift: 'DAY' }, null));
    expect(locks).toEqual(['hall:hall:2026-12-12', 'hall:hall:2026-12-13']);
  });

  it('releasing a hold takes the same hall lock, and works whoever else was quoted', async () => {
    const { service, locks } = fake();
    const a = await run(() => service.reserve('e1', { spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT' }, 'u'));
    if ('errors' in a) throw new Error('unexpected');
    await run(() => service.reserve('e3', { spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT' }, 'u'));
    await run(() => service.hold('e1', a.slots[0].id, { days: 3 }, 'u'));
    locks.length = 0;
    const freed = await run(() => service.releaseHold('e1', a.slots[0].id));
    expect(locks).toEqual(['hall:hall:2026-12-12']);
    expect([freed.slots[0].state, freed.slots[0].holdUntil]).toEqual(['QUOTED', null]);
    // another enquiry's slot, or one that does not exist, is not found — and takes no lock
    locks.length = 0;
    await expect(run(() => service.releaseHold('e3', a.slots[0].id))).rejects.toThrow();
    await expect(run(() => service.releaseHold('e1', 'nope'))).rejects.toThrow();
    expect(locks).toEqual([]);
  });

  it('a closed booking says so when someone tries to hold its hall', async () => {
    const { service, slots } = fake();
    slots.push({ id: 'old', businessId: BIZ, spaceId: 'hall', date: new Date('2026-12-20T00:00:00.000Z'), shift: 'DAY', consultationId: 'e4', note: null, createdAt: new Date() });
    await expect(run(() => service.hold('e4', 'old', { days: 1 }, 'u'))).rejects.toThrow('booking was closed');
  });

  it('release ends a hold now; odd lengths, booked halls and other enquiries are refused', async () => {
    const { service } = fake();
    const r = await run(() => service.reserve('e1', { spaceId: 'hall', date: '2026-12-12', shift: 'DAY' }, 'u'));
    if ('errors' in r) throw new Error('unexpected');
    await expect(run(() => service.hold('e1', r.slots[0].id, { days: 4 }, 'u'))).rejects.toThrow('Choose how long');
    await run(() => service.hold('e1', r.slots[0].id, {}, 'u'));
    const freed = await run(() => service.releaseHold('e1', r.slots[0].id));
    expect([freed.slots[0].state, freed.slots[0].holdUntil]).toEqual(['QUOTED', null]);
    await expect(run(() => service.hold('e2', r.slots[0].id, { days: 1 }, 'u'))).rejects.toThrow();
    const b = await run(() => service.reserve('e2', { spaceId: 'hall', date: '2026-12-13', shift: 'DAY' }, 'u'));
    if ('errors' in b) throw new Error('unexpected');
    await expect(run(() => service.hold('e2', b.slots[0].id, { days: 1 }, 'u'))).rejects.toThrow('The couple has already accepted');
  });

  it('cannot reserve another business’s hall', async () => {
    const { service } = fake();
    await expect(run(() => service.reserve('e1', { spaceId: 'other-hall', date: '2026-12-12', shift: 'NIGHT' }, null))).rejects.toThrow('Choose one of your halls or lawns');
  });

  it('cannot touch another business’s enquiry', async () => {
    const { service } = fake();
    await expect(run(() => service.forEnquiry('not-mine'))).rejects.toThrow();
  });

  it('reserving a booked hall works, with the booking shown as a warning', async () => {
    const { service } = fake();
    await run(() => service.reserve('e2', { spaceId: 'hall', date: '2026-12-12', shift: 'FULL_DAY' }, 'u'));
    const res = await run(() => service.reserve('e1', { spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT' }, 'u'));
    if ('errors' in res) throw new Error('unexpected');
    expect(res.slots).toHaveLength(1);
    expect(res.slots[0].state).toBe('QUOTED');
    expect(res.slots[0].clashes.map((c) => [c.name, c.state])).toEqual([['Neha & Raj', 'BOOKED']]);
  });

  it('the same hall, date and shift twice on one enquiry is kept once', async () => {
    const { service, slots } = fake();
    await run(() => service.reserve('e1', { spaceId: 'hall', date: '2026-12-12', shift: 'DAY' }, null));
    await run(() => service.reserve('e1', { spaceId: 'hall', date: '2026-12-12', shift: 'DAY' }, null));
    expect(slots).toHaveLength(1);
  });

  it('a closed enquiry cannot reserve', async () => {
    const { service } = fake();
    await expect(run(() => service.reserve('lost', { spaceId: 'hall', date: '2026-12-12', shift: 'DAY' }, null))).rejects.toThrow('This enquiry is closed');
  });

  it('blocking a booked shift is refused; the free half can be blocked and freed', async () => {
    const { service, slots } = fake();
    await run(() => service.reserve('e2', { spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT' }, null));
    await expect(run(() => service.block({ spaceId: 'hall', date: '2026-12-12', shift: 'FULL_DAY' }, null))).rejects.toThrow('Royal Hall is not free');
    const block = await run(() => service.block({ spaceId: 'hall', date: '2026-12-12', shift: 'DAY', note: 'Repairs' }, null));
    if ('errors' in block) throw new Error('unexpected');
    expect(block.state).toBe('BLOCKED');
    expect(block.note).toBe('Repairs');
    // a couple's reservation is not a hand block — it cannot be freed from the calendar
    await expect(run(() => service.unblock(slots[0].id))).rejects.toThrow();
    await run(() => service.unblock(block.id));
    expect(slots).toHaveLength(1);
  });

  it('a hand block on the same hall and shift shows in the enquiry’s warning', async () => {
    const { service } = fake();
    await run(() => service.block({ spaceId: 'hall', date: '2026-12-12', shift: 'DAY', note: 'Repairs' }, null));
    const res = await run(() => service.reserve('e1', { spaceId: 'hall', date: '2026-12-12', shift: 'FULL_DAY' }, null));
    if ('errors' in res) throw new Error('unexpected');
    expect(res.slots[0].clashes.map((c) => [c.state, c.note])).toEqual([['BLOCKED', 'Repairs']]);
  });

  it('a quote alone does not stop a block', async () => {
    const { service } = fake();
    await run(() => service.reserve('e1', { spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT' }, null));
    const block = await run(() => service.block({ spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT' }, null));
    expect('errors' in block).toBe(false);
  });

  it('a hall that was reserved is taken out of use, not deleted', async () => {
    const { service, spaces } = fake();
    await run(() => service.reserve('e1', { spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT' }, null));
    await run(() => service.remove('hall'));
    expect(spaces.find((s) => s.id === 'hall')?.active).toBe(false);
    await expect(run(() => service.remove('other-hall'))).rejects.toThrow();
  });

  it('the calendar has this business’s slots in the range, past dates refused on reserve', async () => {
    const { service } = fake();
    await run(() => service.reserve('e2', { spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT' }, null));
    const cal = await run(() => service.calendar({ gte: new Date('2026-11-01T00:00:00Z'), lt: new Date('2027-11-01T00:00:00Z') }));
    expect(cal.slots.map((s) => [s.date, s.state])).toEqual([['2026-12-12', 'BOOKED']]);
    const past = await run(() => service.reserve('e1', { spaceId: 'hall', date: '2026-11-16', shift: 'DAY' }, null));
    expect('errors' in past && past.errors.date).toBe('Pick today or a later date');
  });
});
