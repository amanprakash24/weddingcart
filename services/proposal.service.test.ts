/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { ConflictError, ValidationError } from '@/lib/errors';
import { hashCustomerToken, newCustomerToken } from '@/lib/quotation/proposal';

// All dependencies are passed in as fakes (createProposalService) — no shared module is mocked, so nothing leaks into
// other test files, and no real quotation, booking or activity is ever created. Only '@/lib/prisma' is stubbed because
// importing the service loads the real modules (the same stub every database-touching test in this repo uses).
type Row = Record<string, unknown> & { id: string; status: string; validUntil: Date | null; customerViewedAt: Date | null; changesRequestNote: string | null };
const TOKEN = newCustomerToken();
const FUTURE = new Date(Date.now() + 7 * 86_400_000);
const PAST = new Date(Date.now() - 86_400_000);

let row: Row;
const baseRow = (): Row => ({
  id: 'q1',
  quotationNumber: 'QTN-202610-0001',
  revision: 2,
  status: 'SENT',
  validUntil: FUTURE,
  acceptedAt: null,
  changesRequestedAt: null,
  changesRequestNote: null,
  customerViewedAt: null,
  customerTokenHash: hashCustomerToken(TOKEN),
  subtotal: 100000, discount: 0, gstEnabled: false, gstAmount: 0, total: 100000, advanceAmount: 25000,
  terms: null, inclusions: null, exclusions: null, notes: 'internal',
  consultationId: 'c1', enquiryId: null, leadId: null,
  items: [{ sortOrder: 1, description: 'Hall', category: 'Venue', functionLabel: null, vendorId: 'v1', unitPrice: 100000, quantity: 1 }],
});

const findByCustomerTokenHash = mock(async (hash: string) => (row && row.customerTokenHash === hash ? { ...row } : null));
const findById = mock(async () => ({ ...row }));
const accept = mock(async () => { row.status = 'ACCEPTED'; return {}; });
const createBooking = mock(async () => ({ id: 'b1' }));
const expireOverdue = mock(async () => { if (row.status === 'SENT' && row.validUntil && row.validUntil < new Date()) row.status = 'EXPIRED'; });
const bookingSourceFacts = mock(async () => ({ name: 'Rahul & Priya', phone: '9876543210', city: 'Patna', dateText: '2026-11-18', guestCount: 350, eventType: 'wedding' }));
const activityCreate = mock(async () => ({}));
const applyCommercialEvent = mock(async () => 'NEGOTIATION');
const updateMany = mock(async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
  const matches = Object.entries(args.where).every(([k, v]) => (k === 'id' ? row.id === v : row[k] === v));
  if (!matches) return { count: 0 };
  Object.assign(row, args.data);
  return { count: 1 };
});
const tx = { quotation: { updateMany, findUnique: mock(async () => ({ changesRequestNote: row.changesRequestNote })) } };

mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createProposalService, ProposalNotFoundError } = await import('./proposal.service');
const db = { ...tx, vendor: { findMany: mock(async () => [{ id: 'v1', name: 'Swayamvar Hall' }]) }, $transaction: mock(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
const proposalService = createProposalService({
  db: db as never,
  findByTokenHash: findByCustomerTokenHash as never,
  findById: findById as never,
  expireOverdue: expireOverdue as never,
  sourceFacts: bookingSourceFacts as never,
  accept: accept as never,
  createBooking: createBooking as never,
  logActivity: activityCreate as never,
  applyEvent: applyCommercialEvent as never,
});

beforeEach(() => {
  row = baseRow();
  for (const m of [findByCustomerTokenHash, findById, accept, createBooking, expireOverdue, activityCreate, applyCommercialEvent, updateMany]) m.mockClear();
  accept.mockImplementation(async () => { row.status = 'ACCEPTED'; return {}; });
  createBooking.mockImplementation(async () => ({ id: 'b1' }));
});

describe('view', () => {
  test('a malformed token is "not valid" without touching the database', async () => {
    expect(await proposalService.view('nope')).toBeNull();
    expect(await proposalService.view(undefined)).toBeNull();
    expect(findByCustomerTokenHash).not.toHaveBeenCalled();
  });

  test('an unknown / revoked token is "not valid"', async () => {
    expect(await proposalService.view(newCustomerToken())).toBeNull();
  });

  test.each(['DRAFT', 'SUPERSEDED', 'REJECTED'])('%s → generic "not valid"', async (status) => {
    row.status = status;
    expect(await proposalService.view(TOKEN)).toBeNull();
  });

  test('a live proposal renders, and the FIRST view is tracked exactly once', async () => {
    const p = await proposalService.view(TOKEN);
    expect(p?.state).toBe('OPEN');
    expect(p?.couple.name).toBe('Rahul & Priya');
    expect(p?.items[0].vendorName).toBe('Swayamvar Hall');
    expect(JSON.stringify(p)).not.toContain('internal');
    expect(JSON.stringify(p)).not.toContain('9876543210');
    expect(row.customerViewedAt).toBeInstanceOf(Date);
    expect(activityCreate).toHaveBeenCalledTimes(1);
    expect((activityCreate.mock.calls[0] as unknown[])[0]).toMatchObject({ type: 'PROPOSAL_VIEWED' });

    await proposalService.view(TOKEN);
    expect(activityCreate).toHaveBeenCalledTimes(1); // second view: no new entry
  });

  test('a link-preview bot fetch (trackView: false) does not count as the first view', async () => {
    expect((await proposalService.view(TOKEN, { trackView: false }))?.state).toBe('OPEN');
    expect(row.customerViewedAt).toBeNull();
    expect(activityCreate).not.toHaveBeenCalled();
  });

  test('past its valid-until → the explicit EXPIRED state (not the generic page)', async () => {
    row.validUntil = PAST;
    expect((await proposalService.view(TOKEN))?.state).toBe('EXPIRED');
  });

  test('ACCEPTED stays viewable (thank-you state)', async () => {
    row.status = 'ACCEPTED';
    expect((await proposalService.view(TOKEN))?.state).toBe('ACCEPTED');
  });
});

describe('accept', () => {
  test('uses the existing accept (channel ONLINE, no staff actor), then the existing createBooking', async () => {
    const res = await proposalService.accept(TOKEN);
    expect(res).toEqual({ state: 'ACCEPTED', bookingCreated: true, alreadyAccepted: false });
    expect(accept).toHaveBeenCalledTimes(1);
    const [id, input, actor] = accept.mock.calls[0] as unknown as [string, { channel: string }, string | null];
    expect(id).toBe('q1');
    expect(input.channel).toBe('ONLINE');
    expect(actor).toBeNull();
    expect(createBooking).toHaveBeenCalledWith('q1', {}, null);
  });

  test('booking cannot be created yet (e.g. no clear wedding date) → acceptance still stands, no error for the couple', async () => {
    createBooking.mockImplementation(async () => { throw new ValidationError('Add the wedding date'); });
    expect(await proposalService.accept(TOKEN)).toEqual({ state: 'ACCEPTED', bookingCreated: false, alreadyAccepted: false });
  });

  test('idempotent: accepting again (refresh / double click) does nothing and still says accepted', async () => {
    await proposalService.accept(TOKEN);
    const again = await proposalService.accept(TOKEN);
    expect(again).toEqual({ state: 'ACCEPTED', bookingCreated: false, alreadyAccepted: true });
    expect(accept).toHaveBeenCalledTimes(1);
    expect(createBooking).toHaveBeenCalledTimes(1);
  });

  test('a racing second request that loses the lock is treated as already accepted — no second booking attempt', async () => {
    accept.mockImplementation(async () => { row.status = 'ACCEPTED'; throw new ConflictError('This quotation is already accepted'); });
    expect(await proposalService.accept(TOKEN)).toEqual({ state: 'ACCEPTED', bookingCreated: false, alreadyAccepted: true });
    expect(createBooking).not.toHaveBeenCalled();
  });

  test('a real failure of accept (still SENT) is not hidden', async () => {
    accept.mockImplementation(async () => { throw new Error('db down'); });
    await expect(proposalService.accept(TOKEN)).rejects.toThrow('db down');
    expect(createBooking).not.toHaveBeenCalled();
  });

  test('expired → cannot be accepted; invalid → generic not-found', async () => {
    row.validUntil = PAST;
    await expect(proposalService.accept(TOKEN)).rejects.toBeInstanceOf(ConflictError);
    row = baseRow();
    row.status = 'SUPERSEDED';
    await expect(proposalService.accept(TOKEN)).rejects.toBeInstanceOf(ProposalNotFoundError);
    await expect(proposalService.accept('bad')).rejects.toBeInstanceOf(ProposalNotFoundError);
    expect(accept).not.toHaveBeenCalled();
  });
});

describe('requestChanges', () => {
  test('records the note, logs it, moves the stage — and never touches the quotation content or calls accept/revise', async () => {
    const before = { ...row, items: [...(row.items as unknown[])] };
    await proposalService.requestChanges(TOKEN, '  Please reduce decoration  ');
    expect(row.changesRequestNote).toContain('Please reduce decoration');
    expect(row.changesRequestedAt).toBeInstanceOf(Date);
    for (const field of ['status', 'total', 'subtotal', 'discount', 'advanceAmount', 'terms', 'validUntil']) expect(row[field]).toEqual((before as Record<string, unknown>)[field]);
    expect(row.items).toEqual(before.items);
    const data = (updateMany.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(Object.keys(data).sort()).toEqual(['changesRequestNote', 'changesRequestedAt']);
    expect((activityCreate.mock.calls.at(-1) as unknown[])[0]).toMatchObject({ type: 'QUOTATION_CHANGES_REQUESTED', detail: 'Please reduce decoration' });
    expect(applyCommercialEvent).toHaveBeenCalledWith(tx, 'CONSULTATION', 'c1', 'CHANGES_REQUESTED', null);
    expect(accept).not.toHaveBeenCalled();
  });

  test('a second request is appended to the first', async () => {
    await proposalService.requestChanges(TOKEN, 'Reduce decoration');
    await proposalService.requestChanges(TOKEN, 'Catering for 300');
    expect(row.changesRequestNote).toContain('Reduce decoration');
    expect(row.changesRequestNote).toContain('Catering for 300');
  });

  test('empty or too-long note is refused before anything is written', async () => {
    await expect(proposalService.requestChanges(TOKEN, '   ')).rejects.toBeInstanceOf(ValidationError);
    await expect(proposalService.requestChanges(TOKEN, 'x'.repeat(1001))).rejects.toBeInstanceOf(ValidationError);
    expect(updateMany).not.toHaveBeenCalled();
  });

  test('accepted or expired proposals cannot be changed; invalid links get the generic answer', async () => {
    row.status = 'ACCEPTED';
    await expect(proposalService.requestChanges(TOKEN, 'x')).rejects.toBeInstanceOf(ConflictError);
    row = baseRow();
    row.validUntil = PAST;
    await expect(proposalService.requestChanges(TOKEN, 'x')).rejects.toBeInstanceOf(ConflictError);
    await expect(proposalService.requestChanges(newCustomerToken(), 'x')).rejects.toBeInstanceOf(ProposalNotFoundError);
  });
});
