/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { scopeQuery, ScopeViolationError } from './guard';
import { effectiveScope, hasExplicitScope, PLATFORM_SCOPE, runAsSystem, runInScope, type Scope } from './scope';
import { OWNED_MODELS, PLATFORM_BUSINESS_ID } from './owned';

// The database guard (docs/wedding-os/15-record-ownership.md §4.7). Pure — no database.
const VENUE: Scope = { kind: 'BUSINESS', businessId: 'venue-1', role: 'OWNER' };
const SYSTEM: Scope = { kind: 'SYSTEM', reason: 'test' };

describe('reads, updates and deletes are limited to the business', () => {
  test.each(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany'])('%s', (op) => {
    expect(scopeQuery('Wedding', op, { where: { id: 'w1' }, data: { notes: 'x' } }, VENUE)?.where).toEqual({ id: 'w1', businessId: 'venue-1' });
    expect(scopeQuery('Wedding', op, undefined, VENUE)?.where).toEqual({ businessId: 'venue-1' });
  });

  test('a query naming another business is refused, never widened', () => {
    expect(() => scopeQuery('Lead', 'findMany', { where: { businessId: 'shaadi-shopping' } }, VENUE)).toThrow(ScopeViolationError);
    expect(scopeQuery('Lead', 'findMany', { where: { businessId: 'venue-1' } }, VENUE)?.where).toEqual({ businessId: 'venue-1' });
  });

  test('an owned record never changes owner', () => {
    expect(() => scopeQuery('Invoice', 'update', { where: { id: 'i1' }, data: { businessId: 'other' } }, VENUE)).toThrow('cannot move');
    expect(() => scopeQuery('Invoice', 'update', { where: { id: 'i1' }, data: { business: { connect: { id: 'venue-1' } } } }, VENUE)).toThrow('cannot move');
    expect(() => scopeQuery('Invoice', 'upsert', { where: { id: 'i1' }, create: {}, update: { businessId: 'other' } }, VENUE)).toThrow('cannot move');
  });
});

describe('creates are stamped with the business', () => {
  test('create, createMany, and upsert’s create', () => {
    expect(scopeQuery('Quotation', 'create', { data: { total: 1 } }, VENUE)?.data).toEqual({ total: 1, businessId: 'venue-1' });
    expect(scopeQuery('Quotation', 'createMany', { data: [{ total: 1 }, { total: 2 }] }, VENUE)?.data).toEqual([{ total: 1, businessId: 'venue-1' }, { total: 2, businessId: 'venue-1' }]);
    const up = scopeQuery('Quotation', 'upsert', { where: { id: 'q' }, create: { total: 1 }, update: { total: 2 } }, VENUE);
    expect(up?.create).toEqual({ total: 1, businessId: 'venue-1' });
    expect(up?.where).toEqual({ id: 'q', businessId: 'venue-1' });
  });

  test('creating for another business is refused (by id or by relation)', () => {
    expect(() => scopeQuery('Lead', 'create', { data: { businessId: 'other' } }, VENUE)).toThrow(ScopeViolationError);
    expect(() => scopeQuery('Lead', 'create', { data: { business: { connect: { id: 'other' } } } }, VENUE)).toThrow(ScopeViolationError);
    expect(scopeQuery('Lead', 'create', { data: { business: { connect: { id: 'venue-1' } } } }, VENUE)?.data).toEqual({ business: { connect: { id: 'venue-1' } } });
  });
});

describe('what the guard leaves alone', () => {
  test('tables that are not owned', () => {
    const args = { where: { id: 'v1' } };
    expect(scopeQuery('Vendor', 'findMany', args, VENUE)).toBe(args);
  });

  test('a named SYSTEM scope (deliberate cross-business lookups)', () => {
    const args = { where: { customerTokenHash: 'h' } };
    expect(scopeQuery('Quotation', 'findFirst', args, SYSTEM)).toBe(args);
  });

  test('an operation it does not know is refused, not guessed', () => {
    expect(() => scopeQuery('Payment', 'findRaw', {}, VENUE)).toThrow('not covered');
  });

  test('every owned model is guarded', () => {
    for (const m of OWNED_MODELS) expect(scopeQuery(m, 'count', {}, VENUE)?.where).toEqual({ businessId: 'venue-1' });
  });
});

describe('scope', () => {
  test('no scope = Shaadi Shopping during Phase B (today’s behaviour)', () => {
    expect(hasExplicitScope()).toBe(false);
    expect(effectiveScope()).toEqual(PLATFORM_SCOPE);
    expect(PLATFORM_SCOPE).toEqual({ kind: 'BUSINESS', businessId: PLATFORM_BUSINESS_ID, role: 'OWNER' });
  });

  test('a scope holds across awaits, nests, and ends with its function', async () => {
    await runInScope(VENUE, async () => {
      await new Promise((r) => setTimeout(r, 1));
      expect(effectiveScope()).toEqual(VENUE);
      runAsSystem('nested lookup', () => expect(effectiveScope()).toEqual({ kind: 'SYSTEM', reason: 'nested lookup' }));
      expect(effectiveScope()).toEqual(VENUE);
    });
    expect(hasExplicitScope()).toBe(false);
  });

  test('two requests at the same time never see each other’s scope', async () => {
    const seen: string[] = [];
    const work = (id: string, delay: number) =>
      runInScope({ kind: 'BUSINESS', businessId: id, role: 'STAFF' }, async () => {
        await new Promise((r) => setTimeout(r, delay));
        const s = effectiveScope();
        seen.push(`${id}=${s.kind === 'BUSINESS' ? s.businessId : 'system'}`);
      });
    await Promise.all([work('a', 15), work('b', 1), work('c', 8)]);
    expect(seen.sort()).toEqual(['a=a', 'b=b', 'c=c']);
  });

  test('a scope must say whose it is, and a system scope why', () => {
    expect(() => runInScope({ kind: 'BUSINESS', businessId: '', role: 'OWNER' }, () => 1)).toThrow();
    expect(() => runAsSystem('  ', () => 1)).toThrow();
  });
});

describe('code that could bypass the guard', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
    });
  const root = join(import.meta.dir, '..', '..');
  const source = ['services', 'repositories', 'lib', 'app'].flatMap((d) => files(join(root, d)));
  const OWNED_TABLES = ['leads', 'enquiries', 'consultations', 'quotations', 'bookings', 'commercial_agreements', 'weddings', 'invoices', 'payments'];

  test('raw SQL on an owned table only ever locks a row by id (it returns no data)', () => {
    for (const f of source) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\$(queryRaw|executeRaw)(Unsafe)?`([^`]*)`/g)) {
        const sql = m[3];
        if (!OWNED_TABLES.some((t) => sql.includes(`"${t}"`))) continue;
        expect({ file: f.slice(root.length), sql }).toEqual({ file: f.slice(root.length), sql: expect.stringMatching(/^SELECT "id" FROM "[a-z_]+" WHERE "id" = \$\{[^}]+\} FOR UPDATE$/) });
      }
    }
  });

  test('cross-business (SYSTEM) lookups are only in allowlisted places', () => {
    const ALLOWED: string[] = []; // none yet — add a file here only with a review of why it must see every business
    const users = source.filter((f) => /runAsSystem\(|kind: 'SYSTEM'/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(root.length).replace(/\\/g, '/'));
    expect(users.filter((f) => !f.startsWith('/lib/ownership/'))).toEqual(ALLOWED);
  });

  test('the guard is wired into the shared client', () => {
    const client = readFileSync(join(root, 'lib', 'prisma.ts'), 'utf8');
    expect(client).toContain('scopeQuery(model, operation');
    expect(client).toContain('effectiveScope()');
  });
});
