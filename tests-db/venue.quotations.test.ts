/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runAsSystem, runInScope, type Scope } from '@/lib/ownership/scope';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Phase C: a venue's OWN quotation, on a real database, through the real services and two real vendor logins — the whole path a
// venue owner and their couple take: enquiry → quotation → sent with the couple's link → the couple opens it and asks for changes →
// revised → the couple accepts → the booking and its agreement are made under the venue's own rule. Venue B and Shaadi Shopping
// never see any of it.
dbDescribe('a venue’s own quotations (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let enquiries: typeof import('@/services/venueEnquiry.service').venueEnquiryService;
  let quotes: typeof import('@/services/venueQuotation.service').venueQuotationService;
  let settings: typeof import('@/services/venueSettings.service').venueSettingsService;
  let businessSvc: typeof import('@/services/venueBusiness.service').venueBusinessService;
  let proposalService: typeof import('@/services/proposal.service').proposalService;
  let scopeForProposalToken: typeof import('@/lib/quotation/proposalEntry').scopeForProposalToken;
  const users: string[] = [];
  const vendorIds: string[] = [];
  const venueNames: string[] = [];
  let scopeA: Extract<Scope, { kind: 'BUSINESS' }>;
  let scopeB: Extract<Scope, { kind: 'BUSINESS' }>;
  let enquiryId = '';
  let firstToken = '';
  let secondToken = '';
  let prefix = '';

  const outcome = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);
  const inA = <T>(fn: () => Promise<T>) => runInScope(scopeA, fn);
  const inB = <T>(fn: () => Promise<T>) => runInScope(scopeB, fn);
  const later = (days: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + days * 86_400_000));
  const tokenOf = (linkPath: string) => linkPath.slice('/proposal/'.length);
  // What the couple's browser does: the link runs as the business that owns the quotation (lib/quotation/proposalEntry.ts).
  const asCouple = async <T>(token: string, fn: () => Promise<T>) => runInScope(await scopeForProposalToken(token), fn);
  const nextKind = async (id: string) => (await inA(() => enquiries.get(id))).next.kind;

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    enquiries = (await import('@/services/venueEnquiry.service')).venueEnquiryService;
    quotes = (await import('@/services/venueQuotation.service')).venueQuotationService;
    settings = (await import('@/services/venueSettings.service')).venueSettingsService;
    businessSvc = (await import('@/services/venueBusiness.service')).venueBusinessService;
    proposalService = (await import('@/services/proposal.service')).proposalService;
    scopeForProposalToken = (await import('@/lib/quotation/proposalEntry')).scopeForProposalToken;
    // Two venues of the test's own (never an existing vendor's row or login), each with a vendor login and one listing package.
    const [{ id: anyVendorId }] = await fx.vendors(1);
    const { categoryId } = await app.prisma.vendor.findUniqueOrThrow({ where: { id: anyVendorId }, select: { categoryId: true } });
    for (const [i, label] of ['A', 'B'].entries()) {
      const name = `DBTEST Quote Venue ${label} ${fx.runId}`;
      const v = await app.prisma.vendor.create({ data: { slug: `dbtest-quote-${label.toLowerCase()}-${fx.runId}`, name, categoryId, city: 'Patna', priceMin: 1, priceMax: 2, image: 'x', description: 'x', packages: { create: { name: `Gold ${label}`, description: 'x', price: 150000 } } } });
      vendorIds.push(v.id);
      venueNames.push(name);
      const u = await app.prisma.user.create({ data: { phone: `96000${fx.runId.replace(/\D/g, '').padEnd(4, '0').slice(0, 4)}${i}`, roles: { create: { role: 'VENDOR' } } } });
      users.push(u.id);
      await app.prisma.vendorProfile.create({ data: { userId: u.id, vendorId: v.id } });
    }
    scopeA = (await businessSvc.scopeForVendorLogin(users[0]))!;
    scopeB = (await businessSvc.scopeForVendorLogin(users[1]))!;
    // Venue A books its own customers at 30%, with a 5-day hold, and shows its own number.
    await inA(() => settings.update({ contactPhone: '9876500000', confirmationPercent: '30', holdWindowDays: '5' }));
    prefix = (await inA(() => settings.get())).numberPrefix ?? '';
  });

  afterAll(async () => {
    if (!app) return;
    const ids = [scopeA?.businessId, scopeB?.businessId].filter(Boolean) as string[];
    await runAsSystem('test clean-up', async () => {
      // Same order as fixtures.purge(): agreements, invoices (payments cascade), bookings, quotations, then the couple.
      await app.prisma.commercialAgreement.deleteMany({ where: { businessId: { in: ids } } });
      await app.prisma.invoice.deleteMany({ where: { businessId: { in: ids } } });
      await app.prisma.booking.deleteMany({ where: { businessId: { in: ids } } });
      await app.prisma.quotation.deleteMany({ where: { businessId: { in: ids } } });
      await app.prisma.activityLog.deleteMany({ where: { consultation: { businessId: { in: ids } } } });
      await app.prisma.task.deleteMany({ where: { consultation: { businessId: { in: ids } } } });
      await app.prisma.consultation.deleteMany({ where: { businessId: { in: ids } } });
    });
    await app.prisma.businessMember.deleteMany({ where: { userId: { in: users } } });
    await app.prisma.business.deleteMany({ where: { id: { in: ids } } });
    await app.prisma.vendorProfile.deleteMany({ where: { userId: { in: users } } });
    await app.prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.prisma.vendor.deleteMany({ where: { id: { in: vendorIds } } });
    if (fx) await fx.purge();
  });

  test('a new enquiry has no quotation yet — the form gets the venue’s rule and its own packages', async () => {
    enquiryId = ((await inA(() => enquiries.create({ name: 'Rahul Kumar', phone: '98765 43210', weddingDate: later(60), guestCount: '300', channel: 'PHONE' }, users[0]))) as { id: string }).id;
    const state = await inA(() => quotes.get(enquiryId));
    expect(state).toMatchObject({ customer: { name: 'Rahul Kumar', phone: '9876543210' }, venueName: venueNames[0], rules: { confirmationPercent: 30, holdWindowDays: 5 }, quotation: null });
    expect(state.packages).toEqual([{ name: 'Gold A', price: 150000, perPlate: false }]);
    expect(await nextKind(enquiryId)).toBe('CALL');
  });

  test('a wrong value is explained and nothing is saved', async () => {
    expect(await inA(() => quotes.save(enquiryId, { items: [{ description: '', quantity: '1', unitPrice: 'x' }], validUntil: later(-1) }, users[0]))).toEqual({
      errors: { 'items.0.description': expect.any(String), 'items.0.unitPrice': expect.any(String), validUntil: expect.any(String) },
    });
    expect((await inA(() => quotes.get(enquiryId))).quotation).toBeNull();
  });

  test('saving makes a draft with the venue’s own number, and its rule decides the amount to confirm', async () => {
    const saved = await inA(() => quotes.save(enquiryId, { items: [{ description: 'Hall hire', quantity: '1', unitPrice: '2,00,000' }, { description: 'Veg plate', quantity: '300', unitPrice: '900' }], discount: '20000', validUntil: later(7), inclusions: 'Parking' }, users[0]));
    if ('errors' in saved) throw new Error(JSON.stringify(saved.errors));
    expect(saved.quotation).toMatchObject({ stage: 'DRAFT', subtotal: 470000, discount: 20000, total: 450000, toConfirm: 135000, confirmationPercent: 30, validUntil: later(7), inclusions: 'Parking', hasLink: false, booking: null });
    expect(saved.quotation?.number).toMatch(new RegExp(`^${prefix}-QTN-\\d{6}-0001$`));
    expect(await nextKind(enquiryId)).toBe('QUOTE_DRAFT');
    // The enquiry now carries the venue's city — a booking needs one.
    expect((await runAsSystem('test check', () => app.prisma.consultation.findUniqueOrThrow({ where: { id: enquiryId }, select: { city: true } }))).city).toBe('Patna');
  });

  test('saving again changes the same draft — never a second quotation', async () => {
    const saved = await inA(() => quotes.save(enquiryId, { items: [{ description: 'Hall hire', quantity: '1', unitPrice: '200000' }], validUntil: later(7) }, users[0]));
    expect('quotation' in saved && saved.quotation).toMatchObject({ stage: 'DRAFT', total: 200000, toConfirm: 60000, inclusions: null });
    expect(await runAsSystem('test check', () => app.prisma.quotation.count({ where: { consultationId: enquiryId } }))).toBe(1);
  });

  test('another venue and Shaadi Shopping see nothing of it, and cannot touch it', async () => {
    expect((await outcome(inB(() => quotes.get(enquiryId))))?.name).toBe('NotFoundError');
    expect((await outcome(inB(() => quotes.save(enquiryId, { items: [{ description: 'x', quantity: 1, unitPrice: 1 }], validUntil: later(7) }, users[1]))))?.name).toBe('NotFoundError');
    expect((await outcome(inB(() => quotes.send(enquiryId, users[1]))))?.name).toBe('NotFoundError');
    expect(await app.prisma.quotation.findFirst({ where: { consultationId: enquiryId } })).toBeNull(); // as Shaadi Shopping
    expect(await app.quotationService.listForSource('CONSULTATION', enquiryId)).toEqual([]);
  });

  test('send: sent, with the couple’s link — which shows the venue, its number and its amount to confirm', async () => {
    const sent = await inA(() => quotes.send(enquiryId, users[0]));
    firstToken = tokenOf(sent.linkPath);
    expect(sent.quotation).toMatchObject({ stage: 'SENT', hasLink: true, openedAt: null });
    expect(await nextKind(enquiryId)).toBe('QUOTE_WAITING');
    const page = await asCouple(firstToken, () => proposalService.view(firstToken));
    expect(page).toMatchObject({ number: sent.quotation?.number, total: 200000, advanceAmount: 60000, brand: { name: venueNames[0], phone: '9876500000', isPlatform: false } });
    expect((await inA(() => quotes.get(enquiryId))).quotation?.openedAt).not.toBeNull();
  });

  test('a sent quotation cannot be edited', async () => {
    expect((await outcome(inA(() => quotes.save(enquiryId, { items: [{ description: 'Hall hire', quantity: 1, unitPrice: 1 }], validUntil: later(7) }, users[0]))))?.name).toBe('ConflictError');
  });

  test('the couple asks for changes — the venue sees their words and it becomes the next step', async () => {
    await asCouple(firstToken, () => proposalService.requestChanges(firstToken, 'Can you include the lawn?'));
    expect((await inA(() => quotes.get(enquiryId))).quotation).toMatchObject({ stage: 'CHANGES', changesNote: expect.stringContaining('Can you include the lawn?') });
    expect(await nextKind(enquiryId)).toBe('QUOTE_CHANGES');
  });

  test('revise: a new draft with the next number; the old link stops working; the new one is sent', async () => {
    const draft = await inA(() => quotes.revise(enquiryId, users[0]));
    expect(draft.quotation).toMatchObject({ stage: 'DRAFT', revision: 2, total: 200000, hasLink: false, changesNote: null });
    expect(draft.quotation?.number).toMatch(new RegExp(`^${prefix}-QTN-\\d{6}-0002$`));
    expect(await asCouple(firstToken, () => proposalService.view(firstToken))).toBeNull();
    await inA(() => quotes.save(enquiryId, { items: [{ description: 'Hall hire', quantity: '1', unitPrice: '200000' }, { description: 'Lawn', quantity: '1', unitPrice: '50000' }], validUntil: later(7) }, users[0]));
    const sent = await inA(() => quotes.send(enquiryId, users[0]));
    secondToken = tokenOf(sent.linkPath);
    expect(sent.quotation).toMatchObject({ stage: 'SENT', total: 250000, toConfirm: 75000 });
  });

  test('a fresh link replaces the one before it', async () => {
    const again = await inA(() => quotes.newLink(enquiryId, users[0]));
    expect(await asCouple(secondToken, () => proposalService.view(secondToken))).toBeNull();
    secondToken = tokenOf(again.linkPath);
    expect(await asCouple(secondToken, () => proposalService.view(secondToken))).toMatchObject({ total: 250000 });
  });

  test('the couple accepts: the booking is made at once, under the venue’s own rule, with its own invoice number', async () => {
    expect(await asCouple(secondToken, () => proposalService.accept(secondToken))).toMatchObject({ state: 'ACCEPTED', bookingCreated: true });
    const q = (await inA(() => quotes.get(enquiryId))).quotation;
    expect(q).toMatchObject({ stage: 'ACCEPTED', total: 250000, toConfirm: 75000, confirmationPercent: 30, booking: { holdWindowDays: 5 } });
    expect(await nextKind(enquiryId)).toBe('QUOTE_ACCEPTED');
    await inA(async () => {
      expect(await app.prisma.booking.findFirstOrThrow({ where: { quotationId: q!.id }, select: { city: true, total: true, status: true } })).toEqual({ city: 'Patna', total: 250000, status: 'NEW' });
      const invoice = await app.prisma.invoice.findFirstOrThrow({ where: { quotationId: q!.id }, select: { invoiceNumber: true } });
      expect(invoice.invoiceNumber).toMatch(new RegExp(`^${prefix}-INV-\\d{6}-0001$`));
    });
  });

  test('a later change in Settings does not touch the deal already made', async () => {
    await inA(() => settings.update({ contactPhone: '9876500000', confirmationPercent: '50', holdWindowDays: '10' }));
    expect((await inA(() => quotes.get(enquiryId))).quotation).toMatchObject({ confirmationPercent: 30, toConfirm: 75000, booking: { holdWindowDays: 5 } });
    expect((await outcome(inA(() => quotes.revise(enquiryId, users[0]))))?.name).toBe('ConflictError'); // an accepted quotation is a deal
  });

  test('no wedding date on the enquiry: the couple can still accept, and the venue gives the date to make the booking', async () => {
    const id = ((await inA(() => enquiries.create({ name: 'Priya Singh', phone: '98765 43211', channel: 'WALK_IN' }, users[0]))) as { id: string }).id;
    await inA(() => quotes.save(id, { items: [{ description: 'Hall hire', quantity: '1', unitPrice: '100000' }], validUntil: later(7) }, users[0]));
    const token = tokenOf((await inA(() => quotes.send(id, users[0]))).linkPath);
    expect(await asCouple(token, () => proposalService.accept(token))).toMatchObject({ state: 'ACCEPTED', bookingCreated: false });
    expect((await inA(() => quotes.get(id))).quotation).toMatchObject({ stage: 'ACCEPTED', booking: null, toConfirm: 50000, confirmationPercent: 50 });
    expect((await outcome(inA(() => quotes.book(id, {}, users[0]))))?.name).toBe('ValidationError');
    expect((await outcome(inB(() => quotes.book(id, { weddingDate: later(90) }, users[1]))))?.name).toBe('NotFoundError');
    const booked = await inA(() => quotes.book(id, { weddingDate: later(90) }, users[0]));
    expect(booked.quotation).toMatchObject({ stage: 'ACCEPTED', toConfirm: 50000, confirmationPercent: 50, booking: { holdWindowDays: 10 } });
    expect(booked.customer.weddingDate).toBe(later(90));
  });

  test('venue B’s own quotations count from its own 0001', async () => {
    const id = ((await inB(() => enquiries.create({ name: 'Amit Raj', phone: '98765 43212', weddingDate: later(45), channel: 'PHONE' }, users[1]))) as { id: string }).id;
    const saved = await inB(() => quotes.save(id, { items: [{ description: 'Hall hire', quantity: '1', unitPrice: '100000' }], validUntil: later(7) }, users[1]));
    const prefixB = (await inB(() => settings.get())).numberPrefix;
    expect(prefixB).not.toBe(prefix);
    expect('quotation' in saved && saved.quotation).toMatchObject({ toConfirm: 25000, confirmationPercent: 25 }); // B set no rule
    expect('quotation' in saved && saved.quotation?.number).toMatch(new RegExp(`^${prefixB}-QTN-\\d{6}-0001$`));
    expect((await outcome(inA(() => quotes.get(id))))?.name).toBe('NotFoundError');
  });

  // GST line by line (6 Oct 2026): venue B charges GST on its own quotation. The rate is whatever it types on each line; charging
  // GST needs its GST number; the totals, the invoice the couple's acceptance creates and the couple's page all carry the GST.
  test('GST per line: needs the venue’s GST number; each line keeps its own rate; the couple’s page and the booking carry it', async () => {
    const id = ((await inB(() => enquiries.create({ name: 'Neha Verma', phone: '98765 43213', weddingDate: later(50), channel: 'PHONE' }, users[1]))) as { id: string }).id;
    const lines = { items: [{ description: 'Decoration', quantity: '1', unitPrice: '100000', gstPercent: '18' }, { description: 'Veg plate', quantity: '200', unitPrice: '850', gstPercent: '5' }, { description: 'Hall hire', quantity: '1', unitPrice: '50000' }], validUntil: later(7) };

    // No GST number yet → refused, nothing saved.
    expect(await inB(() => quotes.save(id, lines, users[1]))).toEqual({ errors: { gst: expect.stringContaining('GST number') } });
    expect((await inB(() => quotes.get(id))).quotation).toBeNull();

    await app.prisma.business.update({ where: { id: scopeB.businessId }, data: { gstin: '27AAPFU0939F1ZV' } });
    const saved = await inB(() => quotes.save(id, lines, users[1]));
    if (!('quotation' in saved) || !saved.quotation) throw new Error(JSON.stringify(saved));
    // 1,00,000 @18% = 18,000 · 1,70,000 @5% = 8,500 · 50,000 with no rate → GST 26,500 on 3,20,000
    expect(saved.quotation).toMatchObject({ subtotal: 320000, discount: 0, gstAmount: 26500, total: 346500, toConfirm: 86625, letterhead: { gstin: '27AAPFU0939F1ZV' } });
    expect(saved.quotation.items.map((i) => [i.gstRateBp, i.gst])).toEqual([[1800, 18000], [500, 8500], [null, 0]]);

    // Stored on the lines and on the quotation itself.
    const quotationId = saved.quotation.id;
    const row = await inB(() => app.prisma.quotation.findUniqueOrThrow({ where: { id: quotationId }, select: { gstEnabled: true, gstAmount: true, total: true, items: { orderBy: { sortOrder: 'asc' }, select: { gstRateBp: true } } } }));
    expect(row).toEqual({ gstEnabled: true, gstAmount: 26500, total: 346500, items: [{ gstRateBp: 1800 }, { gstRateBp: 500 }, { gstRateBp: null }] });

    // The couple's page: the venue's GST number, and the GST on each line.
    const token = (await inB(() => quotes.send(id, users[1]))).linkPath.slice('/proposal/'.length);
    const asCouple = async <T>(fn: () => Promise<T>) => runInScope(await scopeForProposalToken(token), fn);
    const page = await asCouple(() => proposalService.view(token));
    expect(page?.brand.gstin).toBe('27AAPFU0939F1ZV');
    expect(page?.items.map((i) => [i.gstPercent, i.gst])).toEqual([['18', 18000], ['5', 8500], [null, 0]]);
    expect(page).toMatchObject({ gstAmount: 26500, total: 346500 });

    // Frozen (7 Oct 2026): the business changes, then removes, its GST number — the quotation that exists keeps the one it was saved with.
    expect((await inB(() => app.prisma.quotation.findUniqueOrThrow({ where: { id: quotationId }, select: { sellerGstin: true } }))).sellerGstin).toBe('27AAPFU0939F1ZV');
    await app.prisma.business.update({ where: { id: scopeB.businessId }, data: { gstin: '10ABCDE1234F1Z5' } });
    expect((await inB(() => quotes.get(id))).quotation?.letterhead.gstin).toBe('27AAPFU0939F1ZV');
    expect((await asCouple(() => proposalService.view(token)))?.brand.gstin).toBe('27AAPFU0939F1ZV');
    await app.prisma.business.update({ where: { id: scopeB.businessId }, data: { gstin: null } });
    expect((await inB(() => quotes.get(id))).quotation?.letterhead.gstin).toBe('27AAPFU0939F1ZV');
    expect((await asCouple(() => proposalService.view(token)))?.brand.gstin).toBe('27AAPFU0939F1ZV');
    await app.prisma.business.update({ where: { id: scopeB.businessId }, data: { gstin: '27AAPFU0939F1ZV' } });

    // A revision keeps every line's rate.
    const revised = await inB(() => quotes.revise(id, users[1]));
    expect(revised.quotation?.items.map((i) => i.gstRateBp)).toEqual([1800, 500, null]);
    expect(revised.quotation).toMatchObject({ gstAmount: 26500, total: 346500 });
  });
});
