/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';

// All dependencies are fakes (createVendorEnquiryService(deps)); only '@/lib/prisma' is stubbed because importing the
// service loads the real modules. Nothing touches a database; no real vendor, quote or enquiry exists here.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createVendorEnquiryService } = await import('./vendorEnquiry.service');

type Row = Record<string, unknown> & { id: string; vendorId: string; sourceKey: string; status: string };
let rows: Row[];
let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
let quote: { id: string; status: string; items: { vendorId: string | null; category: string | null; description: string; functionLabel: string | null }[] } | null;
let selections: { vendorId: string; serviceKey: string }[];
const logs: { type: string; summary: string; sourceType: string; sourceId: string; actorId: string | null }[] = [];

const db = {
  vendorEnquiry: {
    findMany: mock(async (args: { where: { sourceKey?: string; vendorId?: string } }) =>
      rows.filter((r) => (args.where.sourceKey === undefined || r.sourceKey === args.where.sourceKey) && (args.where.vendorId === undefined || r.vendorId === args.where.vendorId))
    ),
    findFirst: mock(async (args: { where: { id: string; vendorId?: string } }) => rows.find((r) => r.id === args.where.id && (args.where.vendorId === undefined || r.vendorId === args.where.vendorId)) ?? null),
    create: mock(async (args: { data: Record<string, unknown> & { vendor: { connect: { id: string } }; quotation?: { connect: { id: string } } } }) => {
      const { vendor, quotation, consultation, enquiry, lead, ...rest } = args.data as unknown as Record<string, never>;
      void consultation; void enquiry; void lead;
      const row = { id: uuid(), status: 'PENDING', vendorId: (vendor as { connect: { id: string } }).connect.id, quotationId: (quotation as { connect: { id: string } } | undefined)?.connect.id ?? null, responseNote: null, suggestedDate: null, quotedAmount: null, responseChannel: null, respondedAt: null, createdAt: new Date(), ...rest } as unknown as Row;
      rows.push(row);
      return row;
    }),
    update: mock(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = rows.find((r) => r.id === args.where.id)!;
      Object.assign(row, args.data);
      return row;
    }),
  },
  quotation: { findFirst: mock(async (args: { where: { status: unknown } }) => (quote && (args.where.status === quote.status || (typeof args.where.status === 'object' && (args.where.status as { in: string[] }).in.includes(quote.status))) ? quote : null)) },
  consultationVendorSelection: { findMany: mock(async () => selections) },
  vendor: { findMany: mock(async (args: { where: { id: { in: string[] } } }) => args.where.id.in.map((id) => ({ id, name: `Vendor ${id}` }))) },
};
const deps = {
  db: db as never,
  sourceFacts: mock(async () => ({ name: 'Rahul & Priya', phone: '9876543210', city: 'Patna', dateText: '2026-11-18', guestCount: 350, eventType: 'wedding' })),
  logActivity: mock(async (d: { type: string; summary: string; sourceType: string; sourceId: string; actorId: string | null }) => void logs.push(d)),
  vendorIdForUser: mock(async (userId: string) => {
    const map: Record<string, string> = { 'user-A': 'vA', 'user-B': 'vB' };
    if (!map[userId]) throw new NotFoundError('Vendor profile', userId);
    return map[userId];
  }),
};
const service = createVendorEnquiryService(deps as never);
const line = (vendorId: string | null, category: string, functionLabel: string | null = null) => ({ vendorId, category, description: category, functionLabel });

beforeEach(() => {
  rows = [];
  logs.length = 0;
  quote = { id: 'q1', status: 'DRAFT', items: [line('vA', 'Venue', 'Wedding'), line('vB', 'Catering'), line(null, 'Mehndi Artists')] };
  selections = [];
});

describe('syncForSource — one enquiry per linked vendor, kept in step with the quote', () => {
  test('saving a quote with vendor lines asks each vendor once — and logs it on the customer record', async () => {
    expect(await service.syncForSource('CONSULTATION', 'c1', 'staff-1')).toEqual({ created: 2, refreshed: 0, reopened: 0, withdrawn: 0 });
    expect(rows.map((r) => [r.vendorId, r.services, r.functions, r.eventDate, r.guestCount, r.city, r.sourceKey])).toEqual([
      ['vA', 'Venue', 'Wedding', '2026-11-18', 350, 'Patna', 'CONSULTATION:c1'],
      ['vB', 'Catering', null, '2026-11-18', 350, 'Patna', 'CONSULTATION:c1'],
    ]);
    expect(logs.map((l) => [l.type, l.summary, l.sourceId, l.actorId])).toEqual([
      ['VENDOR_ENQUIRY_SENT', 'Availability enquiry sent to Vendor vA (Venue)', 'c1', 'staff-1'],
      ['VENDOR_ENQUIRY_SENT', 'Availability enquiry sent to Vendor vB (Catering)', 'c1', 'staff-1'],
    ]);
  });

  test('re-saving or revising does not duplicate; a changed question refreshes a still-pending enquiry', async () => {
    await service.syncForSource('CONSULTATION', 'c1', null);
    expect(await service.syncForSource('CONSULTATION', 'c1', null)).toEqual({ created: 0, refreshed: 0, reopened: 0, withdrawn: 0 });
    quote = { id: 'q2', status: 'DRAFT', items: [line('vA', 'Venue', 'Reception'), line('vB', 'Catering')] }; // a revision
    const r = await service.syncForSource('CONSULTATION', 'c1', null);
    expect(r.created).toBe(0);
    expect(rows).toHaveLength(2);
    expect(rows.find((x) => x.vendorId === 'vA')).toMatchObject({ functions: 'Reception', quotationId: 'q2' });
  });

  test('a vendor removed from the quote is withdrawn; linked again later, they are asked again', async () => {
    await service.syncForSource('CONSULTATION', 'c1', null);
    quote = { id: 'q1', status: 'DRAFT', items: [line('vA', 'Venue')] };
    expect((await service.syncForSource('CONSULTATION', 'c1', null)).withdrawn).toBe(1);
    expect(rows.find((x) => x.vendorId === 'vB')!.status).toBe('WITHDRAWN');
    quote = { id: 'q1', status: 'DRAFT', items: [line('vA', 'Venue'), line('vB', 'Catering')] };
    expect((await service.syncForSource('CONSULTATION', 'c1', null)).reopened).toBe(1);
    expect(rows.find((x) => x.vendorId === 'vB')!.status).toBe('PENDING');
  });

  test('an answered enquiry is not changed by later saves', async () => {
    await service.syncForSource('CONSULTATION', 'c1', null);
    const a = rows.find((x) => x.vendorId === 'vA')!;
    await service.answerAsStaff(a.id, { status: 'AVAILABLE' }, 'PHONE', 'staff-1');
    quote = { id: 'q1', status: 'DRAFT', items: [line('vA', 'Venue', 'Reception'), line('vB', 'Catering')] };
    await service.syncForSource('CONSULTATION', 'c1', null);
    expect(a).toMatchObject({ status: 'AVAILABLE', functions: 'Wedding' });
  });

  test('a vendor chosen on the consultation is asked even before any quote exists', async () => {
    quote = null;
    selections = [{ vendorId: 'v7', serviceKey: 'venue' }];
    await service.syncForSource('CONSULTATION', 'c1', null);
    expect(rows.map((r) => [r.vendorId, r.services, r.quotationId])).toEqual([['v7', 'Venue', null]]);
  });

  test('a lead has no date/city facts — the enquiry is still created, without them', async () => {
    await service.syncForSource('LEAD', 'l1', null);
    expect(rows[0]).toMatchObject({ sourceKey: 'LEAD:l1', eventDate: null, city: null });
    expect(deps.sourceFacts).not.toHaveBeenCalledWith('LEAD', 'l1');
  });
});

describe('answers — staff on the vendor\'s behalf, or the vendor in Vendor OS; same rules', () => {
  beforeEach(async () => {
    await service.syncForSource('CONSULTATION', 'c1', null);
  });
  const idOf = (vendorId: string) => rows.find((r) => r.vendorId === vendorId)!.id;

  test('staff record an answer with the channel; it is logged on the customer record', async () => {
    expect(await service.answerAsStaff(idOf('vA'), { status: 'ALTERNATE_DATE', suggestedDate: '19 Nov' }, 'WHATSAPP', 'staff-1')).toBe('ALTERNATE_DATE');
    expect(rows.find((r) => r.vendorId === 'vA')).toMatchObject({ status: 'ALTERNATE_DATE', suggestedDate: '19 Nov', responseChannel: 'WHATSAPP', respondedById: 'staff-1' });
    expect(logs.at(-1)).toMatchObject({ type: 'VENDOR_ENQUIRY_ANSWERED', summary: 'Vendor vA answered: Suggests another date — suggests 19 Nov (recorded by staff via WhatsApp)', sourceId: 'c1' });
  });

  test('the vendor answers their OWN enquiry in Vendor OS', async () => {
    const view = await service.answerAsVendor('user-A', idOf('vA'), { status: 'QUOTED', quotedAmount: 120000 });
    expect(view).toMatchObject({ status: 'QUOTED', answer: { quotedAmount: 120000, answeredBy: 'you' } });
    expect(rows.find((r) => r.vendorId === 'vA')).toMatchObject({ responseChannel: 'VENDOR_OS', respondedById: 'user-A' });
  });

  test('a vendor cannot answer another vendor\'s enquiry — same "not found" as an unknown id', async () => {
    await expect(service.answerAsVendor('user-A', idOf('vB'), { status: 'AVAILABLE' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.answerAsVendor('user-A', '00000000-0000-4000-8000-999999999999', { status: 'AVAILABLE' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.answerAsVendor('user-A', 'not-an-id', { status: 'AVAILABLE' })).rejects.toBeInstanceOf(NotFoundError);
    expect(rows.find((r) => r.vendorId === 'vB')!.status).toBe('PENDING');
  });

  test('a user without a vendor profile cannot list or answer', async () => {
    await expect(service.listForVendor('admin-1')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.answerAsVendor('admin-1', idOf('vA'), { status: 'AVAILABLE' })).rejects.toBeInstanceOf(NotFoundError);
  });

  test('a withdrawn enquiry cannot be answered; invalid answers are refused before any write', async () => {
    quote = { id: 'q1', status: 'DRAFT', items: [line('vB', 'Catering')] };
    await service.syncForSource('CONSULTATION', 'c1', null);
    await expect(service.answerAsVendor('user-A', idOf('vA'), { status: 'AVAILABLE' })).rejects.toBeInstanceOf(ConflictError);
    await expect(service.answerAsStaff(idOf('vB'), { status: 'AVAILABLE_WITH_CONDITIONS' }, 'PHONE', null)).rejects.toBeInstanceOf(ValidationError);
    expect(rows.find((r) => r.vendorId === 'vB')!.status).toBe('PENDING');
  });

  test('the vendor\'s list shows only their own enquiries, and never who the couple is', async () => {
    const list = await service.listForVendor('user-A');
    expect(list).toHaveLength(1);
    const json = JSON.stringify(list);
    for (const hidden of ['Rahul', '9876543210', 'c1', 'CONSULTATION', 'vB', 'Catering', 'q1']) expect(json).not.toContain(hidden);
  });

  test('staff list carries vendor names and the alerts to act on', async () => {
    await service.answerAsStaff(idOf('vB'), { status: 'NOT_AVAILABLE' }, 'PHONE', null);
    const { enquiries, alerts } = await service.listForSource('CONSULTATION', 'c1');
    expect(enquiries.map((e) => [e.vendorName, e.status, e.answeredVia])).toEqual([['Vendor vA', 'PENDING', null], ['Vendor vB', 'NOT_AVAILABLE', 'phone']]);
    expect(alerts).toEqual(['Vendor vB is not available on 2026-11-18 — replace them on the quote.']);
  });
});
