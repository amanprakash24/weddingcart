import { describe, expect, it } from 'bun:test';
import { claimHallsForAcceptance } from './hallHold.service';

// The acceptance rule (founder, 17 Nov 2026 — option B + decision A): a quotation cannot be accepted or booked while its hall + date +
// shift is taken by anyone else — booked, accepted, held (until the hold ends) or blocked by hand. A stand-in transaction keeps venue
// slots in memory and records the locks taken.

type Row = { id: string; businessId: string; spaceId: string; date: Date; shift: string; consultationId: string | null; holdUntil: Date | null; heldById: string | null; note: string | null };
type Enq = { id: string; name: string; pipelineStage: string; bookings: { status: string; wedding: null }[] };

const NOW = new Date('2026-11-17T06:00:00Z');
const D = new Date('2027-02-14T00:00:00.000Z');
const LATER = new Date('2026-11-19T18:29:59.999Z');
const HALL_NAME: Record<string, string> = { hall: 'Royal Hall', lawn: 'Garden Lawn' };

function fakeTx(rows: Row[], enquiries: Record<string, Enq>) {
  const locks: string[] = [];
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const shape = (r: Row) => ({ ...r, space: { name: HALL_NAME[r.spaceId] }, consultation: r.consultationId ? enquiries[r.consultationId] : null });
  const tx = {
    $executeRaw: async (_s: TemplateStringsArray, key: string) => {
      locks.push(key);
      return 1;
    },
    venueSlot: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        let hit = rows.filter((r) => where.businessId === undefined || r.businessId === where.businessId);
        if (typeof where.consultationId === 'string') hit = hit.filter((r) => r.consultationId === where.consultationId);
        const or = where.OR as { spaceId: string; date: Date }[] | undefined;
        if (or) hit = hit.filter((r) => or.some((o) => o.spaceId === r.spaceId && day(o.date) === day(r.date)));
        return hit.map(shape);
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
let n = 0;
const slot = (over: Partial<Row>): Row => ({ id: `r${++n}`, businessId: 'v1', spaceId: 'hall', date: D, shift: 'NIGHT', consultationId: 'A', holdUntil: null, heldById: null, note: null, ...over });
const refusal = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);

describe('a quotation cannot be accepted over a hall taken by someone else', () => {
  it('1. couple A holds the hall: couple B is refused — told until when, never who; A is untouched', async () => {
    const rows = [slot({ consultationId: 'A', holdUntil: LATER }), slot({ consultationId: 'B' })];
    const { tx } = fakeTx(rows, { A: enq('A'), B: enq('B') });
    const err = await refusal(claimHallsForAcceptance(tx, 'B', NOW));
    expect(err?.name).toBe('ConflictError');
    expect(err?.message).toBe('Royal Hall is temporarily held for another booking for the night of Sun, 14 Feb, 2027, until Thu, 19 Nov, 11:59 pm. You can accept once that hold ends or the venue releases it — please contact the venue.');
    expect(err?.message).not.toContain('Riya');
    expect(rows[0].holdUntil).toEqual(LATER);
  });

  it('2. couple A has accepted, or booked: couple B is refused — "not available", never who (decision A)', async () => {
    for (const a of [enq('A', 'ACCEPTED'), enq('A', 'WON', [{ status: 'CONFIRMED', wedding: null }]), enq('A', 'NEGOTIATION', [{ status: 'NEW', wedding: null }])]) {
      const { tx } = fakeTx([slot({ consultationId: 'A' }), slot({ consultationId: 'B' })], { A: a, B: enq('B') });
      const err = await refusal(claimHallsForAcceptance(tx, 'B', NOW));
      expect(err?.message).toBe('Royal Hall is not available for the night of Sun, 14 Feb, 2027. Please contact the venue.');
    }
  });

  it('3. the venue blocked it by hand: refused', async () => {
    const { tx } = fakeTx([slot({ consultationId: null, note: 'Repairs', shift: 'FULL_DAY' }), slot({ consultationId: 'B' })], { B: enq('B') });
    expect((await refusal(claimHallsForAcceptance(tx, 'B', NOW)))?.message).toContain('is not available for the night of');
  });

  it('4. couple A accepts their own held hall: the booking takes the hold over — same slot, hold cleared', async () => {
    const rows = [slot({ consultationId: 'A', holdUntil: LATER, heldById: 'u1' }), slot({ consultationId: 'B' })];
    const { tx } = fakeTx(rows, { A: enq('A'), B: enq('B') });
    await claimHallsForAcceptance(tx, 'A', NOW);
    expect(rows).toHaveLength(2);
    expect([rows[0].holdUntil, rows[0].heldById]).toEqual([null, null]);
  });

  it('5. expired and released holds, other quotes, closed enquiries and closed bookings never block', async () => {
    const cases: [Row, Enq][] = [
      [slot({ consultationId: 'A', holdUntil: new Date('2026-11-17T05:59:59Z') }), enq('A')], // expired
      [slot({ consultationId: 'A', holdUntil: null }), enq('A')], // released / never held — only quoted
      [slot({ consultationId: 'A' }), enq('A', 'LOST', [{ status: 'NEW', wedding: null }])], // closed enquiry
      [slot({ consultationId: 'A' }), enq('A', 'ACCEPTED', [{ status: 'CLOSED', wedding: null }])], // its booking was closed
    ];
    for (const [a, e] of cases) {
      const { tx } = fakeTx([a, slot({ consultationId: 'B' })], { A: e, B: enq('B') });
      await expect(claimHallsForAcceptance(tx, 'B', NOW)).resolves.toBeUndefined();
    }
  });

  it('6. other shifts, halls and dates are not affected; a full day overlaps both halves', async () => {
    const base = { A: enq('A', 'ACCEPTED'), B: enq('B') };
    const day = fakeTx([slot({ consultationId: 'A', shift: 'DAY' }), slot({ consultationId: 'B', shift: 'NIGHT' })], base);
    await expect(claimHallsForAcceptance(day.tx, 'B', NOW)).resolves.toBeUndefined();
    const lawn = fakeTx([slot({ consultationId: 'A', spaceId: 'lawn' }), slot({ consultationId: 'B' })], base);
    await expect(claimHallsForAcceptance(lawn.tx, 'B', NOW)).resolves.toBeUndefined();
    const nextDay = fakeTx([slot({ consultationId: 'A', date: new Date('2027-02-15T00:00:00.000Z') }), slot({ consultationId: 'B' })], base);
    await expect(claimHallsForAcceptance(nextDay.tx, 'B', NOW)).resolves.toBeUndefined();
    const full = fakeTx([slot({ consultationId: 'A', shift: 'NIGHT', holdUntil: LATER }), slot({ consultationId: 'B', shift: 'FULL_DAY' })], { A: enq('A'), B: enq('B') });
    expect((await refusal(claimHallsForAcceptance(full.tx, 'B', NOW)))?.message).toContain('for the full day of Sun, 14 Feb, 2027');
  });

  it('7. an enquiry with no hall chosen is not affected and takes no lock', async () => {
    const { tx, locks } = fakeTx([slot({ consultationId: 'A', holdUntil: LATER })], { A: enq('A'), C: enq('C') });
    await expect(claimHallsForAcceptance(tx, 'C', NOW)).resolves.toBeUndefined();
    expect(locks).toEqual([]);
  });

  it('8. locks every hall and date it reserves, in a fixed order, with the key hold, release and block use', async () => {
    const rows = [slot({ consultationId: 'B', spaceId: 'lawn' }), slot({ consultationId: 'B', spaceId: 'hall', shift: 'DAY' }), slot({ consultationId: 'B', spaceId: 'hall', shift: 'NIGHT' })];
    const { tx, locks } = fakeTx(rows, { B: enq('B') });
    await claimHallsForAcceptance(tx, 'B', NOW);
    expect(locks).toEqual(['hall:hall:2027-02-14', 'hall:lawn:2027-02-14']);
  });
});
