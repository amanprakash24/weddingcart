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
  businessId: 'shaadi-shopping',
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
// The linked vendor as the database would return it for the public-profile select (owner contact fields are not selected).
const hallRow = {
  id: 'v1', name: 'Swayamvar Hall', slug: 'swayamvar-hall-patna', status: 'PUBLISHED', city: 'Patna', area: 'Boring Road', image: '', images: [], virtualTourVideo: '', description: 'Grand hall',
  features: ['AC'], guestCapacity: 500, venueType: 'indoor', rating: 0, reviewCount: 0, category: { name: 'Venues' },
};
const vendorFindMany = mock(async (args?: unknown) => (void args, [hallRow]));
const confirmedRows = [
  { vendor: { name: 'Artistic Mehndi Studio', category: { name: 'Mehndi' } }, weddingEvent: { type: 'WEDDING', label: null, date: new Date('2026-11-18T12:00:00Z'), venueName: null } },
];
const vendorBookingFindMany = mock(async (args?: unknown) => (void args, confirmedRows));
// "What we offer" lists, by business. BusinessOffering is not an owned table — the service must always name the business.
const offeringRows: Record<string, { id: string; function: string; name: string; price: number; perPlate: boolean }[]> = {
  'venue-1': [
    { id: 'o-lawn', function: 'HALDI', name: 'Lawn', price: 25000, perPlate: false },
    { id: 'o-plate', function: 'HALDI', name: 'Veg plate', price: 450, perPlate: true },
    { id: 'o-hall', function: 'RECEPTION', name: 'Banquet hall', price: 150000, perPlate: false },
  ],
  'venue-2': [{ id: 'o-other', function: 'HALDI', name: 'Another venue’s lawn', price: 1, perPlate: false }],
};
const offerings = mock(async (businessId: string) => offeringRows[businessId] ?? []);
const db = { ...tx, vendor: { findMany: vendorFindMany }, vendorBooking: { findMany: vendorBookingFindMany }, $transaction: mock(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
const paymentsView = { state: 'NOT_STARTED', received: 0, receipts: [], submissions: [], canSubmit: true };
const paymentsForProposal = mock(async (id: string) => (void id, paymentsView));
const paymentSubmit = mock(async () => ({ submitted: true as const }));
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
  payments: { forProposal: paymentsForProposal as never, submit: paymentSubmit as never },
  brand: (async (id: string) => (id === 'venue-1' ? { name: 'Swayamvar Hall', phone: '9876500000', isPlatform: false } : { name: 'Shaadi Shopping', phone: null, isPlatform: true })) as never,
  offerings: offerings as never,
});

beforeEach(() => {
  row = baseRow();
  for (const m of [findByCustomerTokenHash, findById, accept, createBooking, expireOverdue, activityCreate, applyCommercialEvent, updateMany, vendorFindMany, vendorBookingFindMany, paymentsForProposal, paymentSubmit, offerings]) m.mockClear();
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
    expect(p?.items[0].vendor?.name).toBe('Swayamvar Hall');
    expect(p?.items[0].vendor?.profile?.url).toBe('/vendors/swayamvar-hall-patna');
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

describe('view — Step 7: vendor public profile and confirmed vendors', () => {
  test('the vendor query selects public profile fields only — never owner contact or bank details', async () => {
    await proposalService.view(TOKEN);
    const select = (vendorFindMany.mock.calls[0][0] as { select: Record<string, unknown> }).select;
    for (const hidden of ['ownerName', 'ownerPhone', 'ownerEmail', 'paymentDetails', 'defaultTerms', 'priceMin', 'priceMax']) expect(select).not.toHaveProperty(hidden);
  });

  test('an open proposal never reads vendor bookings', async () => {
    const p = await proposalService.view(TOKEN);
    expect(vendorBookingFindMany).not.toHaveBeenCalled();
    expect(p?.confirmedVendors).toEqual([]);
    expect(p?.booked).toBe(false);
  });

  test('accepted + booked: confirmed vendors of the wedding made from THIS booking only, CONFIRMED only, no prices read', async () => {
    row.status = 'ACCEPTED';
    row.booking = { id: 'booking-1', status: 'CONFIRMED' };
    const p = await proposalService.view(TOKEN);
    const args = vendorBookingFindMany.mock.calls[0][0] as { where: unknown; select: Record<string, unknown> };
    expect(args.where).toEqual({ status: 'CONFIRMED', weddingEvent: { wedding: { sourceBookingId: 'booking-1' } } });
    expect(args.select).not.toHaveProperty('agreedPrice');
    expect(p?.booked).toBe(true);
    expect(p?.confirmedVendors).toEqual([{ name: 'Artistic Mehndi Studio', category: 'Mehndi', function: 'WEDDING', date: '2026-11-18T12:00:00.000Z', venueName: null }]);
  });

  test('accepted without a booking: no vendor bookings are read', async () => {
    row.status = 'ACCEPTED';
    row.booking = null;
    const p = await proposalService.view(TOKEN);
    expect(vendorBookingFindMany).not.toHaveBeenCalled();
    expect(p?.booked).toBe(false);
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

describe('payments (Roadmap 1.3)', () => {
  test('an open proposal carries no payments and never reads them', async () => {
    const view = await proposalService.view(TOKEN);
    expect(view?.payments).toBeNull();
    expect(paymentsForProposal).not.toHaveBeenCalled();
  });

  test('an accepted proposal carries its payments section', async () => {
    row.status = 'ACCEPTED';
    row.acceptedAt = new Date();
    const view = await proposalService.view(TOKEN);
    expect(paymentsForProposal).toHaveBeenCalledWith('q1');
    expect(view?.payments).toEqual(paymentsView as never);
  });

  test('a payments failure never hides the accepted proposal', async () => {
    row.status = 'ACCEPTED';
    paymentsForProposal.mockImplementationOnce(async () => { throw new Error('db down'); });
    const view = await proposalService.view(TOKEN);
    expect(view?.number).toBe('QTN-202610-0001');
    expect(view?.payments).toBeNull();
  });

  test('a venue’s own quotation never shows Shaadi Shopping’s payment details, and takes no "I have paid" here', async () => {
    row.businessId = 'venue-1';
    row.status = 'ACCEPTED';
    row.acceptedAt = new Date();
    const view = await proposalService.view(TOKEN);
    expect(view?.brand.isPlatform).toBe(false);
    expect(view?.payments).toBeNull();
    expect(paymentsForProposal).not.toHaveBeenCalled();
    await expect(proposalService.submitPayment(TOKEN, { amount: 1000, utr: '123456789012' }, null)).rejects.toThrow('Please contact Swayamvar Hall about your payment');
    expect(paymentSubmit).not.toHaveBeenCalled();
  });

  test('"I have paid" only on an accepted proposal; invalid links get the generic answer', async () => {
    await expect(proposalService.submitPayment(TOKEN, { amount: 1000, utr: '123456789012' }, null)).rejects.toBeInstanceOf(ConflictError);
    expect(paymentSubmit).not.toHaveBeenCalled();
    await expect(proposalService.submitPayment(newCustomerToken(), { amount: 1000, utr: '123456789012' }, null)).rejects.toBeInstanceOf(ProposalNotFoundError);
    row.status = 'ACCEPTED';
    await expect(proposalService.submitPayment(TOKEN, { amount: 1000, utr: '123456789012' }, null)).resolves.toEqual({ submitted: true, payments: paymentsView as never });
    expect((paymentSubmit.mock.calls.at(-1) as unknown as [{ id: string }])[0].id).toBe('q1');
  });
});

describe('brand on the couple’s link (D8)', () => {
  test('Shaadi Shopping’s quotation shows Shaadi Shopping', async () => {
    expect((await proposalService.view(TOKEN))?.brand).toEqual({ name: 'Shaadi Shopping', phone: null, isPlatform: true });
  });

  test('a venue’s own quotation shows the venue and its number', async () => {
    row.businessId = 'venue-1';
    expect((await proposalService.view(TOKEN))?.brand).toEqual({ name: 'Swayamvar Hall', phone: '9876500000', isPlatform: false });
  });
});

describe('Add an event — what the couple sees', () => {
  test('a venue’s own open proposal lists what THAT venue offers, function by function, with starting prices', async () => {
    row.businessId = 'venue-1';
    const p = await proposalService.view(TOKEN);
    expect(offerings).toHaveBeenCalledWith('venue-1');
    expect(p?.addable).toEqual([
      { function: 'HALDI', label: 'Haldi', items: [{ id: 'o-lawn', name: 'Lawn', price: '₹25,000' }, { id: 'o-plate', name: 'Veg plate', price: '₹450 per plate' }] },
      { function: 'RECEPTION', label: 'Reception', items: [{ id: 'o-hall', name: 'Banquet hall', price: '₹1,50,000' }] },
    ]);
  });

  test('Shaadi Shopping’s proposal has nothing to add and reads no price list', async () => {
    expect((await proposalService.view(TOKEN))?.addable).toEqual([]);
    expect(offerings).not.toHaveBeenCalled();
  });

  test('an accepted or expired venue proposal no longer offers it', async () => {
    row.businessId = 'venue-1';
    row.status = 'ACCEPTED';
    expect((await proposalService.view(TOKEN))?.addable).toEqual([]);
    row = baseRow();
    row.businessId = 'venue-1';
    row.validUntil = PAST;
    expect((await proposalService.view(TOKEN))?.addable).toEqual([]);
    expect(offerings).not.toHaveBeenCalled();
  });
});

describe('requestEvent', () => {
  test('records the function and the ticked offerings in the venue’s own words and prices — the quotation is not touched', async () => {
    row.businessId = 'venue-1';
    const before = { ...row, items: [...(row.items as unknown[])] };
    await proposalService.requestEvent(TOKEN, { function: 'HALDI', offeringIds: ['o-plate', 'o-lawn'], note: ' About 150 guests ' });
    expect(row.changesRequestNote).toContain('Please add Haldi: Lawn (from ₹25,000), Veg plate (from ₹450 per plate).\nAbout 150 guests');
    expect(row.changesRequestedAt).toBeInstanceOf(Date);
    for (const field of ['status', 'total', 'subtotal', 'discount', 'advanceAmount', 'terms', 'validUntil']) expect(row[field]).toEqual((before as Record<string, unknown>)[field]);
    expect(row.items).toEqual(before.items);
    const data = (updateMany.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(Object.keys(data).sort()).toEqual(['changesRequestNote', 'changesRequestedAt']);
    expect((activityCreate.mock.calls.at(-1) as unknown[])[0]).toMatchObject({
      type: 'QUOTATION_CHANGES_REQUESTED',
      summary: 'The couple asked to add Haldi on proposal QTN-202610-0001 (revision 2)',
    });
    expect(applyCommercialEvent).toHaveBeenCalledWith(tx, 'CONSULTATION', 'c1', 'CHANGES_REQUESTED', null);
    expect(accept).not.toHaveBeenCalled();
  });

  test('nothing ticked is fine: the venue is asked for the function alone', async () => {
    row.businessId = 'venue-1';
    await proposalService.requestEvent(TOKEN, { function: 'RECEPTION' });
    expect(row.changesRequestNote).toContain('Please add Reception.');
  });

  test('a tick that is not on THIS venue’s list for THAT function is ignored — another venue’s row, another function’s row, a made-up id', async () => {
    row.businessId = 'venue-1';
    await proposalService.requestEvent(TOKEN, { function: 'HALDI', offeringIds: ['o-other', 'o-hall', 'made-up', 'o-lawn'] });
    expect(offerings).toHaveBeenCalledWith('venue-1');
    expect(row.changesRequestNote).toContain('Please add Haldi: Lawn (from ₹25,000).');
    expect(row.changesRequestNote).not.toContain('Another venue');
    expect(row.changesRequestNote).not.toContain('Banquet hall');
  });

  test('a function the venue has nothing listed for, or any function on a Shaadi Shopping proposal, is refused before anything is written', async () => {
    row.businessId = 'venue-1';
    await expect(proposalService.requestEvent(TOKEN, { function: 'MEHNDI' })).rejects.toBeInstanceOf(ValidationError);
    row = baseRow();
    await expect(proposalService.requestEvent(TOKEN, { function: 'HALDI' })).rejects.toBeInstanceOf(ValidationError);
    expect(updateMany).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
  });

  test('a bad request is refused before the link is even looked up', async () => {
    await expect(proposalService.requestEvent(TOKEN, { function: 'PARTY' })).rejects.toBeInstanceOf(ValidationError);
    await expect(proposalService.requestEvent(TOKEN, null)).rejects.toBeInstanceOf(ValidationError);
    await expect(proposalService.requestEvent(TOKEN, { function: 'HALDI', note: 'x'.repeat(501) })).rejects.toBeInstanceOf(ValidationError);
    expect(findByCustomerTokenHash).not.toHaveBeenCalled();
  });

  test('accepted or expired proposals cannot add an event; invalid links get the generic answer', async () => {
    row.businessId = 'venue-1';
    row.status = 'ACCEPTED';
    await expect(proposalService.requestEvent(TOKEN, { function: 'HALDI' })).rejects.toBeInstanceOf(ConflictError);
    row = baseRow();
    row.businessId = 'venue-1';
    row.validUntil = PAST;
    await expect(proposalService.requestEvent(TOKEN, { function: 'HALDI' })).rejects.toBeInstanceOf(ConflictError);
    await expect(proposalService.requestEvent(newCustomerToken(), { function: 'HALDI' })).rejects.toBeInstanceOf(ProposalNotFoundError);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
