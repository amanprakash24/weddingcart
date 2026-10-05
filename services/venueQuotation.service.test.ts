/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';

// A venue's own quotation for its own enquiry (Phase C). Fakes only — the real quotation rules are tested in
// services/quotation.service and on a real database in tests-db/venue.quotations.test.ts.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createVenueQuotationService } = await import('./venueQuotation.service');

const NOW = new Date('2026-10-05T06:00:00Z');

type Quote = {
  id: string; quotationNumber: string; revision: number; status: string; changesRequestedAt: Date | null; changesRequestNote: string | null;
  items: { description: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number; discount: number; total: number; advanceAmount: number; validUntil: Date | null;
  inclusions: string | null; exclusions: string | null; terms: string | null; sentAt: Date | null; customerViewedAt: Date | null; acceptedAt: Date | null; hasCustomerLink: boolean;
};

let enquiries: Record<string, { id: string; name: string; phone: string; weddingDate: string; city: string | null; pipelineStage: string }>;
let quotes: Quote[];
let business: { id: string; kind: 'VENDOR' | 'PLATFORM'; name: string; numberPrefix: string | null; confirmationPercent: number | null; holdWindowDays: number | null; contactPhone: string | null };
let agreement: { confirmationPercent: number; confirmationAmount: number; holdWindowDays: number } | null;

const consultationUpdate = mock(async ({ where, data }: { where: { id: string }; data: Record<string, string> }) => Object.assign(enquiries[where.id], data));
const body = (input: { items: { description: string; quantity: number; unitPrice: number }[]; discount: number; advanceAmount: number; validUntil: Date; inclusions: string | null; exclusions: string | null; terms: string | null }) => {
  const subtotal = input.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  return { items: input.items.map((i) => ({ ...i, lineTotal: i.quantity * i.unitPrice })), subtotal, discount: input.discount, total: subtotal - input.discount, advanceAmount: input.advanceAmount, validUntil: input.validUntil, inclusions: input.inclusions, exclusions: input.exclusions, terms: input.terms };
};
const create = mock(async (_type: string, _id: string, input: Parameters<typeof body>[0]) => {
  quotes.unshift({ id: `q${quotes.length + 1}`, quotationNumber: `SWA-QTN-202610-000${quotes.length + 1}`, revision: 1, status: 'DRAFT', changesRequestedAt: null, changesRequestNote: null, sentAt: null, customerViewedAt: null, acceptedAt: null, hasCustomerLink: false, ...body(input) });
});
const update = mock(async (id: string, input: Parameters<typeof body>[0]) => void Object.assign(quotes.find((q) => q.id === id)!, body(input)));
const send = mock(async (id: string, _actor?: string | null) => void Object.assign(quotes.find((q) => q.id === id)!, { status: 'SENT', sentAt: NOW }));
const issueCustomerLink = mock(async (id: string) => {
  quotes.find((q) => q.id === id)!.hasCustomerLink = true;
  return { token: 'tok-123' };
});
const revise = mock(async (id: string) => {
  const old = quotes.find((q) => q.id === id)!;
  old.status = 'SUPERSEDED';
  quotes.unshift({ ...old, id: `${id}-r2`, quotationNumber: 'SWA-QTN-202610-0002', revision: 2, status: 'DRAFT', sentAt: null, customerViewedAt: null, changesRequestedAt: null, changesRequestNote: null, hasCustomerLink: false });
});
const createBooking = mock(async (_id?: string, _overrides?: unknown, _actor?: string | null) => {
  agreement = { confirmationPercent: 30, confirmationAmount: 60000, holdWindowDays: 5 };
});

const service = createVenueQuotationService({
  db: {
    consultation: { findUnique: mock(async ({ where }: { where: { id: string } }) => enquiries[where.id] ?? null) as never, update: consultationUpdate as never },
    business: { findUnique: mock(async () => ({ vendorId: 'v1', vendor: { city: 'Patna' } })) as never },
    vendorPackage: { findMany: mock(async () => [{ name: 'Gold package', price: 150000, isPerPlate: false }, { name: 'Veg plate', price: 900, isPerPlate: true }]) as never },
    commercialAgreement: { findUnique: mock(async () => agreement) as never },
  },
  quotations: { listForSource: mock(async () => quotes) as never, create: create as never, update: update as never, send: send as never, revise: revise as never, issueCustomerLink: issueCustomerLink as never, createBooking: createBooking as never },
  business: (async () => business) as never,
  now: () => NOW,
});

const good = { items: [{ description: 'Hall hire', quantity: '1', unitPrice: '200000' }], validUntil: '2026-10-12' };
const outcome = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);

beforeEach(() => {
  for (const m of [consultationUpdate, create, update, send, issueCustomerLink, revise, createBooking]) m.mockClear();
  enquiries = { e1: { id: 'e1', name: 'Rahul Kumar', phone: '9876543210', weddingDate: '2026-12-09', city: null, pipelineStage: 'NEW' } };
  quotes = [];
  agreement = null;
  business = { id: 'venue-1', kind: 'VENDOR', name: 'Swayamvar Hall', numberPrefix: 'SWA', confirmationPercent: 30, holdWindowDays: 5, contactPhone: null };
});

describe('a venue’s own quotation', () => {
  test('before any quotation: the customer, the venue’s rule and its packages', async () => {
    expect(await service.get('e1')).toEqual({
      customer: { name: 'Rahul Kumar', phone: '9876543210', weddingDate: '2026-12-09' },
      venueName: 'Swayamvar Hall',
      rules: { confirmationPercent: 30, holdWindowDays: 5 },
      quotation: null,
      packages: [{ name: 'Gold package', price: 150000, perPlate: false }, { name: 'Veg plate', price: 900, perPlate: true }],
    });
  });

  test('another business’s enquiry is not found', async () => {
    expect((await outcome(service.get('someone-elses')))?.name).toBe('NotFoundError');
    expect((await outcome(service.save('someone-elses', good, 'u1')))?.name).toBe('NotFoundError');
    expect(create).not.toHaveBeenCalled();
  });

  test('saving makes a draft; the amount to confirm is the venue’s rule on the total, never typed', async () => {
    const saved = await service.save('e1', { ...good, discount: '0', advanceAmount: 1, total: 1 }, 'u1');
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0].slice(0, 2)).toEqual(['CONSULTATION', 'e1']);
    expect(create.mock.calls[0][2]).toMatchObject({ items: [{ description: 'Hall hire', quantity: 1, unitPrice: 200000 }], discount: 0, advanceAmount: 60000 });
    expect(create.mock.calls[0][2].validUntil.toISOString()).toBe('2026-10-12T18:29:59.000Z'); // the end of 12 Oct in India
    expect('quotation' in saved && saved.quotation).toMatchObject({ stage: 'DRAFT', total: 200000, toConfirm: 60000, confirmationPercent: 30, validUntil: '2026-10-12', booking: null });
  });

  test('a venue that set no rule quotes under 25%', async () => {
    business.confirmationPercent = null;
    await service.save('e1', good, 'u1');
    expect(create.mock.calls[0][2].advanceAmount).toBe(50000);
  });

  test('the enquiry gets the venue’s city, so the booking can be made when the couple accepts', async () => {
    await service.save('e1', good, 'u1');
    expect(consultationUpdate.mock.calls[0][0]).toEqual({ where: { id: 'e1' }, data: { city: 'Patna' } });
    consultationUpdate.mockClear();
    await service.save('e1', good, 'u1'); // already has a city now
    expect(consultationUpdate).not.toHaveBeenCalled();
  });

  test('saving again changes the draft — it never makes a second quotation', async () => {
    await service.save('e1', good, 'u1');
    await service.save('e1', { ...good, items: [{ description: 'Hall hire', quantity: 1, unitPrice: 300000 }], discount: '20000' }, 'u1');
    expect(create).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toBe('q1');
    expect(update.mock.calls[0][1]).toMatchObject({ discount: 20000, advanceAmount: 84000 });
  });

  test('a wrong value is explained and nothing is saved', async () => {
    expect(await service.save('e1', { items: [], validUntil: '' }, 'u1')).toEqual({ errors: { items: expect.any(String), validUntil: expect.any(String) } });
    expect(create).not.toHaveBeenCalled();
  });

  test('a closed enquiry cannot be quoted', async () => {
    enquiries.e1.pipelineStage = 'LOST';
    expect((await outcome(service.save('e1', good, 'u1')))?.name).toBe('ConflictError');
  });

  test('send: sent, and the couple’s link is given once', async () => {
    await service.save('e1', good, 'u1');
    const sent = await service.send('e1', 'u1');
    expect(send.mock.calls[0]).toEqual(['q1', 'u1']);
    expect(sent.linkPath).toBe('/proposal/tok-123');
    expect(sent.quotation).toMatchObject({ stage: 'SENT', hasLink: true });
    expect(JSON.stringify(await service.get('e1'))).not.toContain('tok-123');
  });

  test('a sent quotation is not edited — it is revised into a new draft', async () => {
    await service.save('e1', good, 'u1');
    await service.send('e1', 'u1');
    expect((await outcome(service.save('e1', good, 'u1')))?.name).toBe('ConflictError');
    expect((await service.revise('e1', 'u1')).quotation).toMatchObject({ stage: 'DRAFT', revision: 2, number: 'SWA-QTN-202610-0002', hasLink: false });
  });

  test('what the couple did is shown: opened, asked for changes', async () => {
    await service.save('e1', good, 'u1');
    await service.send('e1', 'u1');
    Object.assign(quotes[0], { customerViewedAt: NOW, changesRequestedAt: NOW, changesRequestNote: 'Can we add the lawn?' });
    expect((await service.get('e1')).quotation).toMatchObject({ stage: 'CHANGES', openedAt: NOW.toISOString(), changesNote: 'Can we add the lawn?' });
  });

  test('accepted: the agreement’s frozen rule is shown, not today’s setting', async () => {
    await service.save('e1', good, 'u1');
    Object.assign(quotes[0], { status: 'ACCEPTED', acceptedAt: NOW });
    expect((await service.get('e1')).quotation).toMatchObject({ stage: 'ACCEPTED', booking: null, toConfirm: 60000 });
    agreement = { confirmationPercent: 30, confirmationAmount: 60000, holdWindowDays: 5 };
    business.confirmationPercent = 50; // changed in Settings afterwards
    expect((await service.get('e1')).quotation).toMatchObject({ confirmationPercent: 30, toConfirm: 60000, booking: { holdWindowDays: 5 } });
  });

  test('accepted without a wedding date: the venue gives the date and the booking is made', async () => {
    enquiries.e1.weddingDate = '';
    await service.save('e1', good, 'u1');
    expect((await outcome(service.book('e1', { weddingDate: '2026-12-09' }, 'u1')))?.name).toBe('ConflictError'); // not accepted yet
    Object.assign(quotes[0], { status: 'ACCEPTED', acceptedAt: NOW });
    expect((await outcome(service.book('e1', {}, 'u1')))?.name).toBe('ValidationError');
    expect((await outcome(service.book('e1', { weddingDate: '9 December' }, 'u1')))?.name).toBe('ValidationError');
    const booked = await service.book('e1', { weddingDate: '2026-12-09' }, 'u1');
    expect(createBooking.mock.calls[0]).toEqual(['q1', { weddingDate: new Date('2026-12-09T00:00:00.000Z'), city: undefined }, 'u1']);
    expect(enquiries.e1.weddingDate).toBe('2026-12-09');
    expect(booked.quotation?.booking).toEqual({ holdWindowDays: 5 });
  });

  test('nothing to send, share or change before a quotation exists', async () => {
    for (const run of [() => service.send('e1', 'u1'), () => service.newLink('e1', 'u1'), () => service.revise('e1', 'u1'), () => service.book('e1', {}, 'u1')]) expect((await outcome(run()))?.name).toBe('ConflictError');
  });

  test('Shaadi Shopping does not quote here', async () => {
    business = { ...business, id: 'shaadi-shopping', kind: 'PLATFORM' };
    expect((await outcome(service.get('e1')))?.name).toBe('NotFoundError');
    expect((await outcome(service.save('e1', good, 'u1')))?.name).toBe('NotFoundError');
    expect(create).not.toHaveBeenCalled();
  });
});
