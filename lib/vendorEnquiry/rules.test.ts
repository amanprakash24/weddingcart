/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ValidationError } from '@/lib/errors';
import { buildDesired, planSync, staffAlerts, toVendorEnquiryView, validateAnswer, type ExistingEnquiry, type VendorEnquiryRow } from './rules';

const facts = { dateText: '2026-11-18', guestCount: 350, city: 'Patna', eventType: 'wedding' };

describe('validateAnswer — one set of rules for vendors and staff', () => {
  test('plain answers', () => {
    expect(validateAnswer({ status: 'AVAILABLE' })).toEqual({ status: 'AVAILABLE', note: null, suggestedDate: null, quotedAmount: null });
    expect(validateAnswer({ status: 'NOT_AVAILABLE', note: ' booked that day ' }).note).toBe('booked that day');
  });
  test('conditions need a note; another date needs the date; a quote needs an amount or a note', () => {
    expect(() => validateAnswer({ status: 'AVAILABLE_WITH_CONDITIONS' })).toThrow(ValidationError);
    expect(validateAnswer({ status: 'AVAILABLE_WITH_CONDITIONS', note: 'only till 11 pm' }).note).toBe('only till 11 pm');
    expect(() => validateAnswer({ status: 'ALTERNATE_DATE' })).toThrow(ValidationError);
    expect(validateAnswer({ status: 'ALTERNATE_DATE', suggestedDate: '19 Nov' }).suggestedDate).toBe('19 Nov');
    expect(() => validateAnswer({ status: 'QUOTED' })).toThrow(ValidationError);
    expect(validateAnswer({ status: 'QUOTED', quotedAmount: '85000' }).quotedAmount).toBe(85000);
  });
  test('rejects unknown answers, pending/withdrawn, bad amounts and over-long text', () => {
    for (const status of ['PENDING', 'WITHDRAWN', 'MAYBE', undefined]) expect(() => validateAnswer({ status })).toThrow(ValidationError);
    for (const quotedAmount of [-1, 0, 1.5, 'abc', 2_000_000_000]) expect(() => validateAnswer({ status: 'QUOTED', quotedAmount })).toThrow(ValidationError);
    expect(() => validateAnswer({ status: 'AVAILABLE', note: 'x'.repeat(1001) })).toThrow(ValidationError);
  });
  test('fields that do not belong to the answer are dropped', () => {
    expect(validateAnswer({ status: 'AVAILABLE', suggestedDate: '19 Nov', quotedAmount: 5 })).toMatchObject({ suggestedDate: null, quotedAmount: null });
  });
});

describe('buildDesired — which vendors should be asked, and what', () => {
  test('one enquiry per vendor: quote lines and consultation choices combined, labels and functions merged', () => {
    const desired = buildDesired({
      quotationId: 'q1',
      lines: [
        { vendorId: 'v1', category: 'Venue', description: 'Venue', functionLabel: 'Wedding' },
        { vendorId: 'v1', category: 'decorator', description: 'decorator', functionLabel: 'Reception' },
        { vendorId: null, category: 'Catering', description: 'Catering', functionLabel: null },
      ],
      selections: [{ vendorId: 'v2', serviceKey: 'photo-video' }, { vendorId: 'v1', serviceKey: 'venue' }],
      facts,
    });
    expect(desired).toEqual([
      { vendorId: 'v1', services: 'Decorators, Venue', functions: 'Reception, Wedding', eventDate: '2026-11-18', guestCount: 350, city: 'Patna', eventType: 'wedding', quotationId: 'q1' },
      { vendorId: 'v2', services: 'Photography & Video', functions: null, eventDate: '2026-11-18', guestCount: 350, city: 'Patna', eventType: 'wedding', quotationId: null },
    ]);
  });
  test('no vendors → nothing to ask; no facts (a lead) → the question carries no date/city', () => {
    expect(buildDesired({ quotationId: null, lines: [], selections: [], facts })).toEqual([]);
    expect(buildDesired({ quotationId: null, lines: [], selections: [{ vendorId: 'v', serviceKey: 'dj' }], facts: null })[0]).toMatchObject({ eventDate: null, city: null });
  });
});

describe('planSync — create, refresh, reopen, withdraw; answers are never overwritten', () => {
  const base = { services: 'Venue', functions: null, eventDate: '2026-11-18', guestCount: 350, city: 'Patna', eventType: 'wedding', quotationId: 'q1' };
  const ex = (id: string, vendorId: string, status: ExistingEnquiry['status'], over = {}): ExistingEnquiry => ({ id, vendorId, status, ...base, ...over });

  test('a newly linked vendor is asked; an unchanged pending one is left alone', () => {
    expect(planSync([{ vendorId: 'v1', ...base }, { vendorId: 'v2', ...base }], [ex('e1', 'v1', 'PENDING')])).toEqual({ create: [{ vendorId: 'v2', ...base }], refresh: [], reopen: [], withdraw: [] });
  });
  test('a pending enquiry whose question changed (e.g. guests) is refreshed — no duplicate', () => {
    const plan = planSync([{ vendorId: 'v1', ...base, guestCount: 400 }], [ex('e1', 'v1', 'PENDING')]);
    expect(plan.create).toEqual([]);
    expect(plan.refresh).toEqual([{ id: 'e1', details: { ...base, guestCount: 400 } }]);
  });
  test('an answered enquiry is not changed by a later save', () => {
    expect(planSync([{ vendorId: 'v1', ...base, guestCount: 400 }], [ex('e1', 'v1', 'AVAILABLE')])).toEqual({ create: [], refresh: [], reopen: [], withdraw: [] });
  });
  test('a vendor no longer linked is withdrawn (answered or not); already-withdrawn ones stay as they are', () => {
    expect(planSync([], [ex('e1', 'v1', 'PENDING'), ex('e2', 'v2', 'AVAILABLE'), ex('e3', 'v3', 'WITHDRAWN')]).withdraw).toEqual(['e1', 'e2']);
  });
  test('a withdrawn vendor linked again is asked again', () => {
    expect(planSync([{ vendorId: 'v1', ...base }], [ex('e1', 'v1', 'WITHDRAWN')]).reopen).toEqual([{ id: 'e1', details: base }]);
  });
});

describe('toVendorEnquiryView — the vendor never sees who the couple is', () => {
  const row = {
    id: 'e1', vendorId: 'v1', status: 'AVAILABLE', services: 'Venue', functions: 'Wedding', eventDate: '2026-11-18', guestCount: 350, city: 'Patna', eventType: 'wedding', quotationId: 'q-secret',
    responseNote: 'ok', suggestedDate: null, quotedAmount: null, responseChannel: 'WHATSAPP', respondedAt: new Date('2026-10-01T10:00:00Z'), createdAt: new Date('2026-09-30T10:00:00Z'),
    // dirty extras a query might return — must never come out
    consultationId: 'c-secret', sourceKey: 'CONSULTATION:c-secret', respondedById: 'staff-1', name: 'Rahul & Priya', phone: '9876543210',
  } as unknown as VendorEnquiryRow;

  test('exact keys, and nothing identifying', () => {
    const v = toVendorEnquiryView(row);
    expect(Object.keys(v).sort()).toEqual(['answer', 'askedAt', 'city', 'eventDate', 'eventType', 'functions', 'guestCount', 'id', 'services', 'status']);
    const json = JSON.stringify(v);
    for (const hidden of ['q-secret', 'c-secret', 'CONSULTATION:', 'staff-1', 'Rahul', '9876543210', 'v1', 'WHATSAPP']) expect(json).not.toContain(hidden);
    expect(v.answer.answeredBy).toBe('shaadi-shopping');
  });
  test('an answer given in Vendor OS shows as "you"; no answer yet → null', () => {
    expect(toVendorEnquiryView({ ...row, responseChannel: 'VENDOR_OS' }).answer.answeredBy).toBe('you');
    expect(toVendorEnquiryView({ ...row, responseChannel: null, respondedAt: null }).answer).toMatchObject({ answeredBy: null, answeredAt: null });
  });
});

describe('staffAlerts', () => {
  test('only "not available" and "another date" warn staff', () => {
    const alerts = staffAlerts([
      { vendorName: '7 Vachan', status: 'NOT_AVAILABLE', suggestedDate: null, eventDate: '9 Oct' },
      { vendorName: 'Mehak', status: 'ALTERNATE_DATE', suggestedDate: '10 Oct', eventDate: '9 Oct' },
      { vendorName: 'A', status: 'AVAILABLE', suggestedDate: null, eventDate: null },
      { vendorName: 'B', status: 'PENDING', suggestedDate: null, eventDate: null },
    ]);
    expect(alerts).toEqual(['7 Vachan is not available on 9 Oct — replace them on the quote.', "Mehak can't do 9 Oct but suggests 10 Oct — check with the customer or replace them."]);
  });
});

describe('never blocking sales, never reaching the customer (blueprint Decision 8 / 9)', () => {
  const root = join(import.meta.dir, '..', '..');
  const read = (f: string) => readFileSync(join(root, f), 'utf8');

  test('sending / accepting / booking a quote never looks at vendor enquiries', () => {
    expect(read('services/quotation.service.ts')).not.toMatch(/vendorEnquir/i);
  });

  test("the couple's proposal page and its data never read vendor enquiries", () => {
    for (const f of ['services/proposal.service.ts', 'lib/quotation/proposal.ts', 'components/proposal/ProposalClient.tsx', 'app/proposal/[token]/page.tsx']) {
      expect(read(f)).not.toMatch(/vendorEnquir/i);
    }
  });
});
