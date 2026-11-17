import { describe, expect, it } from 'bun:test';
import { claimHallsForAcceptance, heldMessage } from './hallHold.service';

// Option B (founder, 17 Nov 2026): an active hold stops another couple accepting the same hall, date and shift. A stand-in
// transaction keeps venue slots in memory and records the locks taken.

type Row = { id: string; businessId: string; spaceId: string; date: Date; shift: string; consultationId: string; holdUntil: Date | null; heldById: string | null };
type Enq = { id: string; name: string; pipelineStage: string; bookings: { status: string; wedding: null }[] };

const NOW = new Date('2026-11-17T06:00:00Z');
const D = new Date('2027-02-14T00:00:00.000Z');
const LATER = new Date('2026-11-19T18:29:59.999Z');

function fakeTx(rows: Row[], enquiries: Record<string, Enq>) {
  const locks: string[] = [];
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const tx = {
    $executeRaw: async (_s: TemplateStringsArray, key: string) => {
      locks.push(key);
      return 1;
    },
    venueSlot: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        let hit = rows.filter((r) => (where.businessId === undefined || r.businessId === where.businessId));
        if (typeof where.consultationId === 'string') hit = hit.filter((r) => r.consultationId === where.consultationId);
        const not = (where.consultationId as { not?: string } | undefined)?.not;
        if (not) hit = hit.filter((r) => r.consultationId !== not);
        const gt = (where.holdUntil as { gt?: Date } | undefined)?.gt;
        if (gt) hit = hit.filter((r) => r.holdUntil && r.holdUntil > gt);
        const or = where.OR as { spaceId: string; date: Date }[] | undefined;
        if (or) hit = hit.filter((r) => or.some((o) => o.spaceId === r.spaceId && day(o.date) === day(r.date)));
        return hit.map((r) => ({ ...r, space: { name: r.spaceId === 'hall' ? 'Royal Hall' : 'Garden Lawn' }, consultation: enquiries[r.consultationId] }));
      },
      updateMany: async ({ where, data }: { where: { consultationId: string }; data: Partial<Row> }) => {
        const hit = rows.filter((r) => r.consultationId === where.consultationId && r.holdUntil !== null);
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
    },
  };
  return { tx: tx as never, locks };
}

const enq = (id: string, stage = 'QUOTATION_SENT', bookings: Enq['bookings'] = []): Enq => ({ id, name: id === 'A' ? 'Riya & Aman' : 'Neha & Raj', pipelineStage: stage, bookings });
const slot = (over: Partial<Row>): Row => ({ id: Math.random().toString(36).slice(2), businessId: 'v1', spaceId: 'hall', date: D, shift: 'NIGHT', consultationId: 'A', holdUntil: null, heldById: null, ...over });

describe('an active hold stops another couple accepting (option B)', () => {
  it('1. couple A holds the hall: couple B cannot accept the same hall and shift — and is not told who A is', async () => {
    const rows = [slot({ consultationId: 'A', holdUntil: LATER }), slot({ consultationId: 'B' })];
    const { tx } = fakeTx(rows, { A: enq('A'), B: enq('B') });
    const err = await claimHallsForAcceptance(tx, 'B', NOW).catch((e) => e);
    expect(err.name).toBe('ConflictError');
    expect(err.message).toBe('Royal Hall is temporarily held for another booking for the night of Sun, 14 Feb, until Thu, 19 Nov, 11:59 pm. This quotation can be accepted once that hold ends or the venue releases it — please contact the venue.');
    expect(err.message).not.toContain('Riya');
    expect(rows[0].holdUntil).toEqual(LATER); // A's hold untouched
  });

  it('2. couple A accepts: the booking takes over the hold — the same slot, no new reservation, hold cleared', async () => {
    const rows = [slot({ consultationId: 'A', holdUntil: LATER, heldById: 'u1' }), slot({ consultationId: 'B' })];
    const { tx } = fakeTx(rows, { A: enq('A'), B: enq('B') });
    await claimHallsForAcceptance(tx, 'A', NOW);
    expect(rows).toHaveLength(2);
    expect([rows[0].holdUntil, rows[0].heldById]).toEqual([null, null]);
  });

  it('3. an expired hold never blocks', async () => {
    const rows = [slot({ consultationId: 'A', holdUntil: new Date('2026-11-17T05:59:59Z') }), slot({ consultationId: 'B' })];
    const { tx } = fakeTx(rows, { A: enq('A'), B: enq('B') });
    await expect(claimHallsForAcceptance(tx, 'B', NOW)).resolves.toBeUndefined();
  });

  it('4. a released hold never blocks', async () => {
    const rows = [slot({ consultationId: 'A', holdUntil: null }), slot({ consultationId: 'B' })];
    const { tx } = fakeTx(rows, { A: enq('A'), B: enq('B') });
    await expect(claimHallsForAcceptance(tx, 'B', NOW)).resolves.toBeUndefined();
  });

  it('5. other shifts, halls and dates are not affected; a full day overlaps both halves', async () => {
    const base = { A: enq('A'), B: enq('B') };
    const day = fakeTx([slot({ consultationId: 'A', holdUntil: LATER, shift: 'DAY' }), slot({ consultationId: 'B', shift: 'NIGHT' })], base);
    await expect(claimHallsForAcceptance(day.tx, 'B', NOW)).resolves.toBeUndefined();
    const lawn = fakeTx([slot({ consultationId: 'A', holdUntil: LATER, spaceId: 'lawn' }), slot({ consultationId: 'B' })], base);
    await expect(claimHallsForAcceptance(lawn.tx, 'B', NOW)).resolves.toBeUndefined();
    const nextDay = fakeTx([slot({ consultationId: 'A', holdUntil: LATER, date: new Date('2027-02-15T00:00:00.000Z') }), slot({ consultationId: 'B' })], base);
    await expect(claimHallsForAcceptance(nextDay.tx, 'B', NOW)).resolves.toBeUndefined();
    const full = fakeTx([slot({ consultationId: 'A', holdUntil: LATER, shift: 'NIGHT' }), slot({ consultationId: 'B', shift: 'FULL_DAY' })], base);
    await expect(claimHallsForAcceptance(full.tx, 'B', NOW)).rejects.toThrow('for the full day of Sun, 14 Feb');
  });

  it('6. a hold whose couple already accepted or was closed is no longer a hold', async () => {
    const accepted = fakeTx([slot({ consultationId: 'A', holdUntil: LATER }), slot({ consultationId: 'B' })], { A: enq('A', 'ACCEPTED'), B: enq('B') });
    await expect(claimHallsForAcceptance(accepted.tx, 'B', NOW)).resolves.toBeUndefined();
    const lost = fakeTx([slot({ consultationId: 'A', holdUntil: LATER }), slot({ consultationId: 'B' })], { A: enq('A', 'LOST'), B: enq('B') });
    await expect(claimHallsForAcceptance(lost.tx, 'B', NOW)).resolves.toBeUndefined();
  });

  it('7. an enquiry with no hall chosen is not affected and takes no lock', async () => {
    const { tx, locks } = fakeTx([slot({ consultationId: 'A', holdUntil: LATER })], { A: enq('A'), C: enq('C') });
    await expect(claimHallsForAcceptance(tx, 'C', NOW)).resolves.toBeUndefined();
    expect(locks).toEqual([]);
  });

  it('8. locks every hall and date it reserves, in a fixed order, with the key hold and block use', async () => {
    const rows = [slot({ consultationId: 'B', spaceId: 'lawn' }), slot({ consultationId: 'B', spaceId: 'hall', shift: 'DAY' }), slot({ consultationId: 'B', spaceId: 'hall', shift: 'NIGHT' })];
    const { tx, locks } = fakeTx(rows, { B: enq('B') });
    await claimHallsForAcceptance(tx, 'B', NOW);
    expect(locks).toEqual(['hall:hall:2027-02-14', 'hall:lawn:2027-02-14']);
  });

  it('the message names the shift and the end of the hold', () => {
    expect(heldMessage('Garden Lawn', 'DAY', '2027-02-14', LATER)).toContain('Garden Lawn is temporarily held for another booking for the day of Sun, 14 Feb, until Thu, 19 Nov, 11:59 pm.');
  });
});
