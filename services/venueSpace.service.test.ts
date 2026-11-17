import { describe, expect, it, mock } from 'bun:test';
import { runInScope } from '@/lib/ownership/scope';
import type { VenueSpaceDeps } from './venueSpace.service';

mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createVenueSpaceService } = await import('./venueSpace.service');

// Halls and shifts: every read and write names the current business; a clash on an enquiry is a warning; a hand block over a
// booked shift is refused. A fake database keeps rows in memory and applies the `where` fields this service uses.

type SpaceRow = { id: string; businessId: string; name: string; capacity: number | null; active: boolean; sortOrder: number; createdAt: Date };
type SlotRow = { id: string; businessId: string; spaceId: string; date: Date; shift: string; consultationId: string | null; note: string | null; createdAt: Date };
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
  const enquiries: Enquiry[] = [
    { id: 'e1', businessId: BIZ, name: 'Riya & Aman', pipelineStage: 'QUOTATION_SENT', bookings: [] },
    { id: 'e2', businessId: BIZ, name: 'Neha & Raj', pipelineStage: 'WON', bookings: [{ status: 'CONFIRMED', wedding: null }] },
    { id: 'lost', businessId: BIZ, name: 'Gone', pipelineStage: 'LOST', bookings: [] },
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
    return { id: s.id, spaceId: s.spaceId, date: s.date, shift: s.shift, note: s.note, consultation: e ? { id: e.id, name: e.name, pipelineStage: e.pipelineStage, bookings: e.bookings } : null };
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
  const service = createVenueSpaceService({ db: db as unknown as VenueSpaceDeps['db'], now: () => new Date('2026-11-17T06:00:00Z') });
  return { service, spaces, slots };
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
