/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { nestedOwnedWrite, parentRefs, scopeQuery, ScopeViolationError } from './guard';
import { CHILD_MODELS, OWNED_MODELS, OWNED_RELATIONS, SELF_LINKS } from './owned';
import { PLATFORM_SCOPE, runInScope, scopeForOwnedQuery, UnscopedAccessError, type Scope } from './scope';
import { platformScoped, scoped } from './entry';

// Phase B3 — every entry point states its business; unscoped work is a visible bug; nested writes cannot slip past the guard.
const VENUE: Scope = { kind: 'BUSINESS', businessId: 'venue-1', role: 'OWNER' };
const root = join(import.meta.dir, '..', '..');

describe('work without a scope', () => {
  test("OWNERSHIP_UNSCOPED=error refuses it (fail-closed)", () => {
    expect(() => scopeForOwnedQuery('Wedding', 'findMany', 'error')).toThrow(UnscopedAccessError);
  });

  test('the default (warn) runs it as Shaadi Shopping and says so once per model and operation', () => {
    const warn = console.warn;
    const seen: string[] = [];
    console.warn = (m: string) => void seen.push(m);
    try {
      expect(scopeForOwnedQuery('Invoice', 'count', undefined)).toEqual(PLATFORM_SCOPE);
      scopeForOwnedQuery('Invoice', 'count', undefined);
      expect(seen.filter((m) => m.includes('Invoice.count'))).toHaveLength(1);
    } finally {
      console.warn = warn;
    }
  });

  test('inside a scope, the mode does not matter', () => {
    runInScope(VENUE, () => expect(scopeForOwnedQuery('Wedding', 'findMany', 'error')).toEqual(VENUE));
  });

  test('entry wrappers run the handler in their scope and keep its result', async () => {
    const handler = async (x: number) => x * 2;
    expect(await platformScoped(handler)(21)).toBe(42);
    expect(await scoped(VENUE, async () => scopeForOwnedQuery('Lead', 'findMany', 'error'))()).toEqual(VENUE);
  });
});

describe('nested writes', () => {
  test('a nested create of an OWNED record is refused; children may be created nested', () => {
    expect(nestedOwnedWrite('Booking', { quotation: { create: {} } })).toBe('quotation');
    expect(nestedOwnedWrite('Wedding', { invoices: { create: [{}] } })).toBe('invoices');
    expect(nestedOwnedWrite('Quotation', { items: { create: [{ description: 'x' }] } })).toBeNull();
    expect(() => scopeQuery('Booking', 'create', { data: { quotation: { create: {} } } }, VENUE)).toThrow(ScopeViolationError);
    expect(() => scopeQuery('Invoice', 'upsert', { where: { id: 'i' }, create: {}, update: { payments: { create: {} } } }, VENUE)).toThrow(ScopeViolationError);
  });

  test('connect / disconnect on a forward link is allowed (the id is checked); anything through a back-relation is refused', () => {
    expect(nestedOwnedWrite('Task', { wedding: { connect: { id: 'w' } } })).toBeNull();
    expect(nestedOwnedWrite('Invoice', { wedding: { disconnect: true } })).toBeNull();
    expect(nestedOwnedWrite('Wedding', { invoices: { connect: [{ id: 'i' }] } })).toBe('invoices'); // would pull an invoice over
    expect(nestedOwnedWrite('Booking', { agreement: { connect: { id: 'a' } } })).toBe('agreement');
  });

  test('a SYSTEM scope is not limited', () => {
    expect(scopeQuery('Booking', 'create', { data: { quotation: { create: {} } } }, { kind: 'SYSTEM', reason: 'x' })).toEqual({ data: { quotation: { create: {} } } });
  });

  test('a revision or a milestone dependency is checked like any parent', () => {
    expect(parentRefs('Quotation', 'create', { data: { supersedesId: 'q0' } })).toEqual([{ relation: 'supersedes', model: 'Quotation', id: 'q0' }]);
    expect(parentRefs('TimelineMilestone', 'update', { where: { id: 'm' }, data: { dependsOn: { connect: { id: 'm0' } } } })).toEqual([{ relation: 'dependsOn', model: 'TimelineMilestone', id: 'm0' }]);
  });
});

describe('the relation maps match the schema', () => {
  const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
  const block = (m: string) => {
    const start = schema.indexOf(`model ${m} {`);
    expect(start).toBeGreaterThan(-1);
    return schema.slice(start, schema.indexOf('\n}', start));
  };
  const owned = new Set<string>(OWNED_MODELS);

  test('OWNED_RELATIONS: every relation field (either direction) to an owned record', () => {
    let compared = 0;
    for (const m of [...OWNED_MODELS, ...CHILD_MODELS]) {
      const fromSchema = [...block(m).matchAll(/^\s+(\w+)\s+(\w+)(\[\])?\??\s/gm)].filter((r) => owned.has(r[2])).map((r) => r[1]).sort();
      expect({ m, fields: [...(OWNED_RELATIONS[m] ?? [])].sort() }).toEqual({ m, fields: fromSchema });
      compared += fromSchema.length;
    }
    expect(compared).toBeGreaterThanOrEqual(55);
  });

  test('SELF_LINKS: every link from a scoped record to its own model', () => {
    for (const m of [...OWNED_MODELS, ...CHILD_MODELS]) {
      const fromSchema = [...block(m).matchAll(/^\s+(\w+)\s+(\w+)\??\s+@relation\((?:"\w+",\s*)?fields: \[(\w+)\]/gm)].filter((r) => r[2] === m).map((r) => `${r[1]}:${r[3]}`);
      expect({ m, links: (SELF_LINKS[m] ?? []).map((l) => `${l.relation}:${l.fk}`) }).toEqual({ m, links: fromSchema });
    }
  });
});

describe('every entry point states its business', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : [p];
    });
  const rel = (p: string) => p.slice(root.length + 1).replace(/\\/g, '/');
  const app = files(join(root, 'app'));

  // Exempt with a reason: they never touch owned records.
  const EXEMPT_ROUTES: Record<string, string> = {
    'app/api/health/route.ts': 'returns a constant; no database',
    'app/api/auth/[...nextauth]/route.ts': 'logins only (users, OTPs) — not owned records',
    'app/api/workspace/route.ts': 'the signed-in person’s own memberships only — not owned records; it is what CHOOSES the scope',
  };

  test('every API route exports its handlers through a scope wrapper', () => {
    const routes = app.filter((p) => rel(p).startsWith('app/api/') && p.endsWith('route.ts'));
    expect(routes.length).toBeGreaterThan(90);
    for (const r of routes) {
      const name = rel(r);
      if (EXEMPT_ROUTES[name]) continue;
      const src = readFileSync(r, 'utf8');
      const exported = [...src.matchAll(/^export (?:async function|const|function) (GET|POST|PUT|PATCH|DELETE)\b(.*)$/gm)];
      expect({ name, count: exported.length > 0 }).toEqual({ name, count: true });
      for (const e of exported) expect({ name, line: e[0] }).toEqual({ name, line: expect.stringMatching(/= (platformScoped|scoped|venueScoped|proposalScoped)\(/) });
    }
  });

  // Server pages that read or write owned records (proposal link, RSVP, customer portal, Vendor OS).
  const OWNED_DATA_PAGES = [
    'app/customer/page.tsx', 'app/proposal/[token]/page.tsx', 'app/rsvp/[token]/page.tsx', 'app/vendor/page.tsx',
    'app/vendor/enquiries/page.tsx', 'app/vendor/proposals/page.tsx', 'app/vendor/proposals/[quotationId]/page.tsx',
    // Vendor OS (rebased 4 Oct 2026): what Shaadi Shopping shares with the vendor — their bookings, availability and payouts.
    'app/vendor/today/page.tsx', 'app/vendor/weddings/page.tsx', 'app/vendor/services/page.tsx', 'app/vendor/availability/page.tsx',
    'app/vendor/payments/page.tsx',
  ];

  test('pages that touch owned records are wrapped', () => {
    for (const p of OWNED_DATA_PAGES) expect({ p, src: readFileSync(join(root, p), 'utf8') }).toEqual({ p, src: expect.stringMatching(/export default (platformScoped|scoped|proposalPageScoped)\(/) });
  });

  test('any OTHER page reaching the database uses only services for public, unowned data', () => {
    const OWNED_SERVICES = /from '@\/services\/(lead|leadInbox|leadWorkspace|leadStage|enquiry|consultation|consultationVendorSelection|quotation|proposal|booking|agreement|commercialFlow|weddingConversion|weddingWorkspace|invoice|invoiceWorkflow|payment|payout|clientPortal|venuePortal|vendorEnquiry|vendorProposal|guest|approval|commandCenter|founderDashboard|stats)\.service'|from '@\/repositories\/(lead|enquiry|consultation|quotation|booking|wedding|invoice|payment|task|guest|activityLog|vendorBooking|weddingEvent)\.repository'|from '@\/lib\/prisma'/;
    const pages = app.filter((p) => /(page|layout)\.tsx$|sitemap\.ts$/.test(p) && !OWNED_DATA_PAGES.includes(rel(p)));
    const offenders = pages.filter((p) => OWNED_SERVICES.test(readFileSync(p, 'utf8'))).map(rel);
    expect(offenders).toEqual([]);
  });
});
