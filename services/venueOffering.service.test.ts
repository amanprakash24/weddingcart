/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { runInScope, PLATFORM_SCOPE, type Scope } from '@/lib/ownership/scope';

// The business's price list — "What we offer". Fakes only. The table is not guarded by the database guard, so these tests pin
// that the service itself names the scope's business on every read and write.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createVenueOfferingService } = await import('./venueOffering.service');

type Row = { id: string; businessId: string; kind: string; function: string | null; name: string; description: string | null; price: number; perPlate: boolean; active: boolean; sourcePackageId?: string | null };
let rows: Row[];
type Where = Partial<Omit<Row, 'sourcePackageId'>> & { sourcePackageId?: string | null | { not: null } };
const matches = (r: Row, where: Where) =>
  Object.entries(where).every(([k, v]) => (v && typeof v === 'object' ? (r[k as keyof Row] ?? null) !== null : (r[k as keyof Row] ?? null) === v));
const pick = ({ id, kind, function: fn, name, description, price, perPlate, active }: Row) => ({ id, kind, function: fn, name, description, price, perPlate, active });
const row = (id: string, businessId: string, over: Partial<Row> = {}): Row => ({ id, businessId, kind: 'RENTAL', function: null, name: id, description: null, price: 1, perPlate: false, active: true, ...over });

// Two listings: venue A's has two packages, venue B's has one. A business with no listing has none.
const businesses: Record<string, { vendorId: string | null; vendor: { category: { slug: string } } | null }> = {
  'venue-a': { vendorId: 'va', vendor: { category: { slug: 'venue' } } },
  'venue-b': { vendorId: 'vb', vendor: { category: { slug: 'catering' } } },
};
const packages = [
  { id: 'pa1', vendorId: 'va', name: 'Gold package', price: 150000, isPerPlate: false },
  { id: 'pa2', vendorId: 'va', name: 'Royal plate', price: 1200, isPerPlate: true },
  { id: 'pb1', vendorId: 'vb', name: 'B package', price: 90000, isPerPlate: false },
];

const db = {
  businessOffering: {
    findMany: mock(async ({ where, select }: { where: Where; select: Record<string, boolean> }) => rows.filter((r) => matches(r, where)).map((r) => (select.sourcePackageId ? { sourcePackageId: r.sourcePackageId ?? null } : pick(r)))),
    count: mock(async ({ where }: { where: Where }) => rows.filter((r) => matches(r, where)).length),
    create: mock(async ({ data }: { data: Omit<Row, 'id'> }) => void rows.push({ id: `o${rows.length + 1}`, ...data })),
    updateMany: mock(async ({ where, data }: { where: Where; data: Partial<Row> }) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    }),
    deleteMany: mock(async ({ where }: { where: Where }) => {
      const before = rows.length;
      rows = rows.filter((r) => !matches(r, where));
      return { count: before - rows.length };
    }),
  },
  business: { findUnique: mock(async ({ where }: { where: { id: string } }) => businesses[where.id] ?? null) },
  vendorPackage: { findMany: mock(async ({ where }: { where: { vendorId: string } }) => packages.filter((p) => p.vendorId === where.vendorId)) },
};
const service = createVenueOfferingService({ db: db as never });

const A: Scope = { kind: 'BUSINESS', businessId: 'venue-a', role: 'OWNER' };
const B: Scope = { kind: 'BUSINESS', businessId: 'venue-b', role: 'STAFF' };
const inA = <T>(fn: () => Promise<T>) => runInScope(A, fn);
const inB = <T>(fn: () => Promise<T>) => runInScope(B, fn);
const outcome = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);

beforeEach(() => {
  rows = [row('b1', 'venue-b', { function: 'HALDI', name: 'B lawn', price: 30000 })];
});

describe('the price list', () => {
  test('a business adds to its own list and sees only its own', async () => {
    expect(await inA(() => service.list())).toEqual([]);
    const after = await inA(() => service.create({ kind: 'DECORATION', function: 'HALDI', name: 'Haldi decoration', price: '25,000', description: 'Marigold' }));
    expect(after).toEqual([{ id: 'o2', kind: 'DECORATION', function: 'HALDI', name: 'Haldi decoration', description: 'Marigold', price: 25000, perPlate: false, active: true }]);
    expect(rows.find((r) => r.id === 'o2')?.businessId).toBe('venue-a');
    expect((await inB(() => service.list())).map((o) => o.name)).toEqual(['B lawn']);
  });

  test('an item need not be for one function', async () => {
    const after = await inA(() => service.create({ kind: 'RENTAL', name: 'Banquet hall', price: '200000' }));
    expect(after).toMatchObject([{ kind: 'RENTAL', function: null, name: 'Banquet hall' }]);
  });

  test('a business id in the request is ignored — the scope decides', async () => {
    await inA(() => service.create({ kind: 'RENTAL', name: 'Lawn', price: '1', businessId: 'venue-b' }));
    expect(rows.at(-1)?.businessId).toBe('venue-a');
  });

  test('a wrong value is explained and nothing is saved', async () => {
    expect(await inA(() => service.create({ kind: 'RENTAL', name: '', price: 'x' }))).toEqual({ errors: { name: expect.any(String), price: expect.any(String) } });
    expect(await inA(() => service.create({ name: 'Lawn', price: '1' }))).toEqual({ errors: { kind: expect.any(String) } });
    expect(rows).toHaveLength(1);
  });

  test('change and remove — only its own; another business’s is not found and untouched', async () => {
    await inA(() => service.create({ kind: 'RENTAL', function: 'HALDI', name: 'Lawn', price: '40000' }));
    expect(await inA(() => service.update('o2', { kind: 'RENTAL', function: 'MEHNDI', name: 'Lawn (evening)', price: '45000' }))).toMatchObject([{ id: 'o2', function: 'MEHNDI', name: 'Lawn (evening)', price: 45000 }]);
    expect((await outcome(inA(() => service.update('b1', { kind: 'RENTAL', name: 'hacked', price: '1' }))))?.name).toBe('NotFoundError');
    expect((await outcome(inA(() => service.setActive('b1', false))))?.name).toBe('NotFoundError');
    expect((await outcome(inA(() => service.remove('b1'))))?.name).toBe('NotFoundError');
    expect(rows.find((r) => r.id === 'b1')).toMatchObject({ name: 'B lawn', price: 30000, active: true });
    expect(await inA(() => service.remove('o2'))).toEqual([]);
  });

  test('hide keeps the item in the list; offer it again brings it back', async () => {
    await inA(() => service.create({ kind: 'SERVICE', name: 'DJ', price: '15000' }));
    expect(await inA(() => service.setActive('o2', false))).toMatchObject([{ id: 'o2', name: 'DJ', active: false }]);
    expect(await inA(() => service.setActive('o2', true))).toMatchObject([{ id: 'o2', active: true }]);
  });

  test('at most 60 of one kind', async () => {
    rows.push(...Array.from({ length: 60 }, (_, i) => row(`a${i}`, 'venue-a', { kind: 'RENTAL' })));
    expect((await outcome(inA(() => service.create({ kind: 'RENTAL', name: 'One more', price: '1' }))))?.name).toBe('ConflictError');
    expect(await inA(() => service.create({ kind: 'CATERING', name: 'Veg plate', price: '1' }))).toHaveLength(61);
  });

  test('Shaadi Shopping, and work with no business, have no price list here', async () => {
    expect((await outcome(runInScope(PLATFORM_SCOPE, () => service.list())))?.name).toBe('NotFoundError');
    expect((await outcome(runInScope(PLATFORM_SCOPE, () => service.catalog())))?.name).toBe('NotFoundError');
    expect((await outcome(runInScope({ kind: 'SYSTEM', reason: 'test' }, () => service.create({ kind: 'RENTAL', name: 'Lawn', price: '1' }))))?.name).toBe('NotFoundError');
    expect(rows).toHaveLength(1);
  });
});

describe('the whole catalog screen', () => {
  test('the list, the kinds that fit the business, and the packages on ITS public page', async () => {
    const a = await inA(() => service.catalog());
    expect(a.items).toEqual([]);
    expect(a.kinds).toEqual(['RENTAL', 'CATERING', 'DECORATION', 'SERVICE', 'PACKAGE']);
    expect(a.listingPackages).toEqual([{ id: 'pa1', name: 'Gold package', price: 150000, perPlate: false, copied: false }, { id: 'pa2', name: 'Royal plate', price: 1200, perPlate: true, copied: false }]);
    const b = await inB(() => service.catalog());
    expect(b.kinds[0]).toBe('CATERING');
    expect(b.listingPackages.map((p) => p.name)).toEqual(['B package']);
  });

  test('a business with no public page has no packages there, and the general kinds', async () => {
    const c = await runInScope({ kind: 'BUSINESS', businessId: 'venue-c', role: 'OWNER' }, () => service.catalog());
    expect(c).toEqual({ items: [], kinds: ['SERVICE', 'PACKAGE', 'RENTAL'], listingPackages: [] });
  });

  test('a package is copied into the list once, as the business’s own package', async () => {
    const after = await inA(() => service.copyListingPackage('pa2'));
    expect(after).toEqual([{ id: 'o2', kind: 'PACKAGE', function: null, name: 'Royal plate', description: null, price: 1200, perPlate: true, active: true }]);
    expect(rows.at(-1)).toMatchObject({ businessId: 'venue-a', sourcePackageId: 'pa2' });
    expect((await inA(() => service.catalog())).listingPackages.map((p) => [p.name, p.copied])).toEqual([['Gold package', false], ['Royal plate', true]]);
    expect((await outcome(inA(() => service.copyListingPackage('pa2'))))?.name).toBe('ConflictError');
    expect(rows.filter((r) => r.businessId === 'venue-a')).toHaveLength(1);
  });

  test('another listing’s package cannot be copied', async () => {
    expect((await outcome(inA(() => service.copyListingPackage('pb1'))))?.name).toBe('NotFoundError');
    expect((await outcome(inA(() => service.copyListingPackage('made-up'))))?.name).toBe('NotFoundError');
    expect(rows).toHaveLength(1);
  });
});
