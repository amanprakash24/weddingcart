/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ownerFilter, parentRefs, scopeQuery, ScopeViolationError } from './guard';
import { CHILD_MODELS, OWNED_MODELS, PARENT_LINKS } from './owned';
import type { Scope } from './scope';

// Phase B2: records that belong to their business through a parent. Pure — no database.
const VENUE: Scope = { kind: 'BUSINESS', businessId: 'venue-1', role: 'OWNER' };

describe('reading a child follows its parents to the business', () => {
  test('one parent, a chain, and several possible parents', () => {
    expect(ownerFilter('QuotationItem', 'b')).toEqual({ quotation: { businessId: 'b' } });
    expect(ownerFilter('VendorBooking', 'b')).toEqual({ weddingEvent: { wedding: { businessId: 'b' } } });
    expect(ownerFilter('Payout', 'b')).toEqual({ vendorBooking: { weddingEvent: { wedding: { businessId: 'b' } } } });
    expect(ownerFilter('ApprovalRequest', 'b')).toEqual({ OR: [{ wedding: { businessId: 'b' } }, { weddingEvent: { wedding: { businessId: 'b' } } }] });
  });

  test('the owner filter is ADDED to the query, never replacing its own conditions', () => {
    const out = scopeQuery('Guest', 'findMany', { where: { weddingId: 'w1', AND: [{ name: 'x' }], OR: [{ rsvpStatus: 'YES' }] } }, VENUE);
    expect(out?.where).toEqual({ weddingId: 'w1', OR: [{ rsvpStatus: 'YES' }], AND: [{ name: 'x' }, { wedding: { businessId: 'venue-1' } }] });
    expect(scopeQuery('Task', 'update', { where: { id: 't1' }, data: { status: 'DONE' } }, VENUE)?.where).toEqual({ id: 't1', AND: [ownerFilter('Task', 'venue-1')] });
  });

  test('creates are left as written (their parents are checked separately); unknown operations refused', () => {
    const args = { data: { weddingId: 'w1', name: 'Guest' } };
    expect(scopeQuery('Guest', 'create', args, VENUE)).toBe(args);
    expect(() => scopeQuery('Guest', 'findRaw', {}, VENUE)).toThrow(ScopeViolationError);
  });

  test('a SYSTEM scope is unchanged', () => {
    const args = { where: { id: 'g' } };
    expect(scopeQuery('Guest', 'findUnique', args, { kind: 'SYSTEM', reason: 'x' })).toBe(args);
  });
});

describe('every parent a write points at is found, by column or by connect', () => {
  test('create, createMany, update and upsert', () => {
    expect(parentRefs('Guest', 'create', { data: { weddingId: 'w1' } })).toEqual([{ relation: 'wedding', model: 'Wedding', id: 'w1' }]);
    expect(parentRefs('Quotation', 'create', { data: { consultation: { connect: { id: 'c1' } }, items: { create: [] } } })).toEqual([{ relation: 'consultation', model: 'Consultation', id: 'c1' }]);
    expect(parentRefs('Task', 'createMany', { data: [{ weddingId: 'w1' }, { leadId: 'l1' }] }).map((r) => r.id)).toEqual(['w1', 'l1']);
    expect(parentRefs('VendorBooking', 'update', { where: { id: 'v' }, data: { weddingEventId: 'e2' } })).toEqual([{ relation: 'weddingEvent', model: 'WeddingEvent', id: 'e2' }]);
    expect(parentRefs('Invoice', 'upsert', { where: { id: 'i' }, create: { weddingId: 'w1' }, update: { quotationId: 'q1' } }).map((r) => r.id)).toEqual(['w1', 'q1']);
    expect(parentRefs('Vendor', 'create', { data: { categoryId: 'c' } })).toEqual([]);
    expect(parentRefs('Guest', 'findMany', { where: { weddingId: 'w1' } })).toEqual([]);
  });
});

describe('the parent map matches the schema', () => {
  const schema = readFileSync(join(import.meta.dir, '..', '..', 'prisma', 'schema.prisma'), 'utf8');
  const scoped = new Set<string>([...OWNED_MODELS, ...CHILD_MODELS]);

  test('every relation between owned / child records is listed, with its real column — and nothing else', () => {
    let compared = 0;
    for (const model of scoped) {
      const start = schema.indexOf(`model ${model} {`);
      const body = schema.slice(start, schema.indexOf('\n}', start)); // by position: works with LF and CRLF
      expect(start).toBeGreaterThan(-1);
      const fromSchema = [...body.matchAll(/^\s+(\w+)\s+(\w+)\??\s+@relation\((?:"\w+",\s*)?fields: \[(\w+)\]/gm)]
        .filter((r) => scoped.has(r[2]) && r[2] !== model)
        .map((r) => `${r[1]}:${r[3]}:${r[2]}`)
        .sort();
      const listed = PARENT_LINKS[model as keyof typeof PARENT_LINKS].map((l) => `${l.relation}:${l.fk}:${l.model}`).sort();
      expect({ model, links: listed }).toEqual({ model, links: fromSchema });
      compared += fromSchema.length;
    }
    expect(compared).toBeGreaterThanOrEqual(45); // guards against comparing empty blocks (CRLF once made every block empty)
  });

  test('every child reaches an owned record (no child is invisible by construction)', () => {
    for (const model of CHILD_MODELS) expect(PARENT_LINKS[model].length).toBeGreaterThan(0);
  });
});
