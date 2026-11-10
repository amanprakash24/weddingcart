/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { runInScope, PLATFORM_SCOPE, type Scope } from '@/lib/ownership/scope';
import type { NewEnquiry } from '@/lib/venue/enquiry';

// Every enquiry, typed once (Vivah OS phase 1): the one way an enquiry enters a venue (services/venueEnquiry.service.ts `intake`).
// A fake database; nothing real is touched. The real guard keeps each venue to its own records — these tests pin what intake does
// inside one venue: one client per mobile, a repeat added to the open enquiry, where it came from, and who it goes to.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createVenueEnquiryService } = await import('./venueEnquiry.service');

const VENUE: Scope = { kind: 'BUSINESS', businessId: 'venue-a', role: 'OWNER' };
const NOW = new Date('2026-11-11T06:00:00Z');

type Enq = { id: string; clientId: string; pipelineStage: string; createdAt: Date; data: Record<string, unknown> };

function setup(opts: { enquiries?: Enq[]; clients?: Record<string, string>; raceOnce?: boolean } = {}) {
  const clients = new Map(Object.entries(opts.clients ?? {})); // phone → client id
  const enquiries: Enq[] = [...(opts.enquiries ?? [])];
  const history: { consultationId: string; type: string; summary: string; detail?: string; by?: string }[] = [];
  let raced = false;
  const db = {
    businessClient: {
      upsert: mock(async (a: { where: { businessId_phone: { businessId: string; phone: string } }; create: { phone: string; name: string } }) => {
        if (opts.raceOnce && !raced) {
          raced = true;
          clients.set(a.create.phone, 'c-raced');
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        const id = clients.get(a.where.businessId_phone.phone) ?? `c-${clients.size + 1}`;
        clients.set(a.where.businessId_phone.phone, id);
        return { id };
      }),
    },
    consultation: {
      findFirst: mock(async (a: { where: { clientId: string; pipelineStage: { notIn: string[] } } }) =>
        enquiries.filter((e) => e.clientId === a.where.clientId && !a.where.pipelineStage.notIn.includes(e.pipelineStage)).sort((x, y) => +y.createdAt - +x.createdAt)[0] ?? null),
      count: mock(async (a: { where: { clientId: string } }) => enquiries.filter((e) => e.clientId === a.where.clientId).length),
      create: mock(async (a: { data: Record<string, unknown> }) => {
        const id = `e-${enquiries.length + 1}`;
        enquiries.push({ id, clientId: a.data.clientId as string, pipelineStage: 'NEW', createdAt: NOW, data: a.data });
        return { id };
      }),
      findUnique: mock(async () => null),
      findMany: mock(async () => []),
      update: mock(async () => ({})),
    },
    activityLog: {
      create: mock(async (a: { data: { type: string; summary: string; detail?: string; consultation: { connect: { id: string } }; performedBy?: { connect: { id: string } } } }) => {
        history.push({ consultationId: a.data.consultation.connect.id, type: a.data.type, summary: a.data.summary, detail: a.data.detail, by: a.data.performedBy?.connect.id });
        return {};
      }),
    },
    businessMember: { findFirst: mock(async () => ({ userId: 'u-owner' })), findMany: mock(async () => []) },
    business: { findUnique: mock(async () => ({ name: 'Touch of Cozy', vendorId: 'v-cozy', kind: 'VENDOR' })) },
    task: { create: mock(async () => ({})), updateMany: mock(async () => ({ count: 0 })) },
    paymentSubmission: { count: mock(async () => 0) },
    $transaction: mock(async (fn: (tx: unknown) => unknown) => fn(db)),
  };
  const match = { find: mock(async () => null), noteOnPlatformRecord: mock(async () => undefined) };
  const service = createVenueEnquiryService({ db: db as never, match: match as never, now: () => NOW });
  return { service, db, enquiries, history, clients, match };
}

const neha = (over: Partial<NewEnquiry> = {}): NewEnquiry => ({
  name: 'Neha Sharma', phone: '9876543210', eventType: 'wedding', weddingDate: '2027-02-22', days: 2, functions: ['HALDI', 'MEHNDI', 'SANGEET', 'WEDDING'],
  guestCount: 400, budget: 800000, need: 'Lawn for the Haldi', channel: 'GOOGLE', ...over,
});

describe('a new enquiry', () => {
  test('from the enquiry page: a client is made, the enquiry keeps every detail and where it came from, and goes to the owner', async () => {
    const { service, enquiries, history, match } = setup();
    expect(await runInScope(VENUE, () => service.intake(neha(), { sourceDetail: 'Enquiry page', actorId: null }))).toEqual({ id: 'e-1', repeat: false });
    expect(enquiries[0].data).toMatchObject({
      name: 'Neha Sharma', phone: '9876543210', eventType: 'wedding', weddingDate: '2027-02-22', days: 2, functions: ['HALDI', 'MEHNDI', 'SANGEET', 'WEDDING'],
      guestCount: 400, totalBudget: 800000, message: 'Lawn for the Haldi', channel: 'GOOGLE', sourceDetail: 'Enquiry page', clientId: 'c-1',
      assignedToId: 'u-owner', assignedById: null, assignedAt: NOW,
    });
    expect(history).toEqual([{ consultationId: 'e-1', type: 'STATUS_CHANGED', summary: 'Enquiry added — google · enquiry page', detail: expect.stringContaining('Haldi, Mehndi, Sangeet, Wedding · 400 guests · budget ₹8,00,000'), by: undefined }]);
    expect(match.find).toHaveBeenCalledWith('v-cozy', '9876543210'); // the Shaadi Shopping commission check still runs (D4)
  });

  test('typed by the team: it is theirs to handle', async () => {
    const { service, enquiries, history } = setup();
    await runInScope(VENUE, () => service.intake(neha({ channel: 'PHONE' }), { sourceDetail: null, actorId: 'u-staff' }));
    expect(enquiries[0].data).toMatchObject({ assignedToId: 'u-staff', assignedById: 'u-staff', sourceDetail: null });
    expect(history[0]).toMatchObject({ summary: 'Enquiry added — phone call', by: 'u-staff', detail: undefined });
  });

  test('outside one business it refuses — an enquiry always belongs to a venue', async () => {
    const { service } = setup();
    await expect(runInScope({ kind: 'SYSTEM', reason: 'test' }, () => service.intake(neha(), { sourceDetail: null, actorId: null }))).rejects.toThrow();
    expect(PLATFORM_SCOPE.kind).toBe('BUSINESS');
  });

  test('two enquiries from the same number at the same moment: the second finds the first one’s client', async () => {
    const { service, enquiries } = setup({ raceOnce: true });
    await runInScope(VENUE, () => service.intake(neha(), { sourceDetail: null, actorId: null }));
    expect(enquiries[0].data.clientId).toBe('c-raced');
  });
});

describe('the same number again', () => {
  test('while their enquiry is open: added to it, not a new stranger — and what they asked this time is in its history', async () => {
    const open: Enq = { id: 'e-old', clientId: 'c-neha', pipelineStage: 'CONTACTED', createdAt: new Date('2026-11-01'), data: {} };
    const { service, enquiries, history, db } = setup({ clients: { '9876543210': 'c-neha' }, enquiries: [open] });
    const r = await runInScope(VENUE, () => service.intake(neha({ eventType: 'wedding', guestCount: 450, channel: 'INSTAGRAM' }), { sourceDetail: 'Enquiry page', actorId: null }));
    expect(r).toEqual({ id: 'e-old', repeat: true });
    expect(enquiries).toHaveLength(1);
    expect(history).toEqual([{ consultationId: 'e-old', type: 'NOTE', summary: 'Enquired again — instagram · enquiry page', detail: expect.stringContaining('450 guests'), by: undefined }]);
    expect((db.businessClient.upsert.mock.calls[0] as unknown as [{ update: unknown }])[0].update).toEqual({ name: 'Neha Sharma' }); // their latest name
  });

  test('typed by the team while one is open: a new enquiry as they asked (one family, two events), under the same client', async () => {
    const open: Enq = { id: 'e-old', clientId: 'c-neha', pipelineStage: 'CONTACTED', createdAt: new Date('2026-11-01'), data: {} };
    const { service, enquiries, history, db } = setup({ clients: { '9876543210': 'c-neha' }, enquiries: [open] });
    expect(await runInScope(VENUE, () => service.intake(neha({ eventType: 'engagement', functions: [] }), { sourceDetail: null, actorId: 'u-staff' }))).toEqual({ id: 'e-2', repeat: false });
    expect(enquiries[1].data).toMatchObject({ clientId: 'c-neha', eventType: 'engagement' });
    expect(history.map((h) => h.summary)).toEqual(['Enquiry added — google', 'Already a client — 1 earlier enquiry with you']);
    expect(db.consultation.findFirst).not.toHaveBeenCalled();
  });

  test('after their earlier enquiry closed: a new enquiry, marked "already a client"', async () => {
    const lost: Enq = { id: 'e-old', clientId: 'c-neha', pipelineStage: 'LOST', createdAt: new Date('2026-06-01'), data: {} };
    const { service, enquiries, history } = setup({ clients: { '9876543210': 'c-neha' }, enquiries: [lost] });
    expect(await runInScope(VENUE, () => service.intake(neha(), { sourceDetail: null, actorId: 'u-staff' }))).toEqual({ id: 'e-2', repeat: false });
    expect(enquiries[1].data.clientId).toBe('c-neha');
    expect(history.map((h) => h.summary)).toEqual(['Enquiry added — google', 'Already a client — 1 earlier enquiry with you']);
  });
});

describe('+ New Enquiry (the team’s form)', () => {
  test('checks the form, then takes the same way in', async () => {
    const { service, enquiries } = setup();
    expect(await runInScope(VENUE, () => service.create({ name: 'Ankit', phone: '9123456789', eventType: 'birthday', channel: 'WALK_IN' }, 'u-staff'))).toEqual({ id: 'e-1', repeat: false });
    expect(enquiries[0].data).toMatchObject({ eventType: 'birthday', functions: [], days: 1, channel: 'WALK_IN', assignedToId: 'u-staff' });
    expect(await runInScope(VENUE, () => service.create({ name: 'A', phone: '1', channel: 'WALK_IN' }, 'u-staff'))).toEqual({ errors: expect.objectContaining({ name: expect.any(String), phone: expect.any(String) }) });
  });
});
