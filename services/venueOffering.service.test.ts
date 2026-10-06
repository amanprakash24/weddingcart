/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { runInScope, PLATFORM_SCOPE, type Scope } from '@/lib/ownership/scope';

// What a venue offers for each function (Phase C). Fakes only. The table is not guarded by the database guard, so these tests pin
// that the service itself names the scope's business on every read and write.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createVenueOfferingService } = await import('./venueOffering.service');

type Row = { id: string; businessId: string; function: string; name: string; price: number; perPlate: boolean };
let rows: Row[];
const matches = (r: Row, where: Partial<Row>) => Object.entries(where).every(([k, v]) => r[k as keyof Row] === v);
const pick = ({ id, function: fn, name, price, perPlate }: Row) => ({ id, function: fn, name, price, perPlate });

const db = {
  businessOffering: {
    findMany: mock(async ({ where }: { where: Partial<Row> }) => rows.filter((r) => matches(r, where)).map(pick)),
    findFirst: mock(async ({ where }: { where: Partial<Row> }) => rows.find((r) => matches(r, where)) ?? null),
    count: mock(async ({ where }: { where: Partial<Row> }) => rows.filter((r) => matches(r, where)).length),
    create: mock(async ({ data }: { data: Omit<Row, 'id'> }) => void rows.push({ id: `o${rows.length + 1}`, ...data })),
    updateMany: mock(async ({ where, data }: { where: Partial<Row>; data: Partial<Row> }) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    }),
    deleteMany: mock(async ({ where }: { where: Partial<Row> }) => {
      const before = rows.length;
      rows = rows.filter((r) => !matches(r, where));
      return { count: before - rows.length };
    }),
  },
};
const service = createVenueOfferingService({ db: db as never });

const A: Scope = { kind: 'BUSINESS', businessId: 'venue-a', role: 'OWNER' };
const B: Scope = { kind: 'BUSINESS', businessId: 'venue-b', role: 'STAFF' };
const inA = <T>(fn: () => Promise<T>) => runInScope(A, fn);
const inB = <T>(fn: () => Promise<T>) => runInScope(B, fn);
const outcome = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);

beforeEach(() => {
  rows = [{ id: 'b1', businessId: 'venue-b', function: 'HALDI', name: 'B lawn', price: 30000, perPlate: false }];
});

describe('what a venue offers', () => {
  test('a venue adds to its own list and sees only its own', async () => {
    expect(await inA(() => service.list())).toEqual([]);
    const after = await inA(() => service.create({ function: 'HALDI', name: 'Haldi decoration', price: '25,000' }));
    expect(after).toEqual([{ id: 'o2', function: 'HALDI', name: 'Haldi decoration', price: 25000, perPlate: false }]);
    expect(rows.find((r) => r.id === 'o2')?.businessId).toBe('venue-a');
    expect((await inB(() => service.list())).map((o) => o.name)).toEqual(['B lawn']);
  });

  test('a business id in the request is ignored — the scope decides', async () => {
    await inA(() => service.create({ function: 'HALDI', name: 'Lawn', price: '1', businessId: 'venue-b' }));
    expect(rows.at(-1)?.businessId).toBe('venue-a');
  });

  test('a wrong value is explained and nothing is saved', async () => {
    expect(await inA(() => service.create({ function: 'HALDI', name: '', price: 'x' }))).toEqual({ errors: { name: expect.any(String), price: expect.any(String) } });
    expect(rows).toHaveLength(1);
  });

  test('change and remove — only its own; another venue’s is not found and untouched', async () => {
    await inA(() => service.create({ function: 'HALDI', name: 'Lawn', price: '40000' }));
    expect(await inA(() => service.update('o2', { function: 'MEHNDI', name: 'Lawn (evening)', price: '45000', perPlate: false }))).toEqual([{ id: 'o2', function: 'MEHNDI', name: 'Lawn (evening)', price: 45000, perPlate: false }]);
    expect((await outcome(inA(() => service.update('b1', { function: 'HALDI', name: 'hacked', price: '1' }))))?.name).toBe('NotFoundError');
    expect((await outcome(inA(() => service.remove('b1'))))?.name).toBe('NotFoundError');
    expect(rows.find((r) => r.id === 'b1')).toMatchObject({ name: 'B lawn', price: 30000 });
    expect(await inA(() => service.remove('o2'))).toEqual([]);
  });

  test('at most 40 for one function', async () => {
    rows.push(...Array.from({ length: 40 }, (_, i) => ({ id: `a${i}`, businessId: 'venue-a', function: 'HALDI', name: `Item ${i}`, price: 1, perPlate: false })));
    expect((await outcome(inA(() => service.create({ function: 'HALDI', name: 'One more', price: '1' }))))?.name).toBe('ConflictError');
    expect(await inA(() => service.create({ function: 'MEHNDI', name: 'Mehndi seating', price: '1' }))).toHaveLength(41);
  });

  test('Shaadi Shopping, and work with no business, have no price list here', async () => {
    expect((await outcome(runInScope(PLATFORM_SCOPE, () => service.list())))?.name).toBe('NotFoundError');
    expect((await outcome(runInScope({ kind: 'SYSTEM', reason: 'test' }, () => service.create({ function: 'HALDI', name: 'Lawn', price: '1' }))))?.name).toBe('NotFoundError');
    expect(rows).toHaveLength(1);
  });
});
