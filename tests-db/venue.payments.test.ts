/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runAsSystem, runInScope, type Scope } from '@/lib/ownership/scope';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Phase C: payments on a venue's OWN booking, on a real database, through the real services and two real vendor logins.
// The couple accepts venue A's quotation (30% confirms, a part payment holds the date for 5 days); the venue records what it
// receives: a part payment holds the date, the amount to confirm confirms the booking, the rest goes to the balance. No wedding is
// created yet. Venue B and Shaadi Shopping never see any of it.
dbDescribe('payments on a venue’s own booking (real database)', () => {
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
  let scopeA: Extract<Scope, { kind: 'BUSINESS' }>;
  let scopeB: Extract<Scope, { kind: 'BUSINESS' }>;
  let enquiryId = '';
  let quotationId = '';
  let prefix = '';

  const outcome = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);
  const inA = <T>(fn: () => Promise<T>) => runInScope(scopeA, fn);
  const inB = <T>(fn: () => Promise<T>) => runInScope(scopeB, fn);
  const later = (days: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + days * 86_400_000));
  const money = async () => (await inA(() => quotes.get(enquiryId))).quotation?.booking;
  const nextKind = async () => (await inA(() => enquiries.get(enquiryId))).next.kind;
  const bookingStatus = () => inA(async () => (await app.prisma.booking.findFirstOrThrow({ where: { quotationId }, select: { status: true } })).status);
  const paymentCount = () => inA(() => app.prisma.payment.count({ where: { invoice: { quotationId } } }));

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
    // Two venues of the test's own (never an existing vendor's row or login), each with a vendor login.
    const [{ id: anyVendorId }] = await fx.vendors(1);
    const { categoryId } = await app.prisma.vendor.findUniqueOrThrow({ where: { id: anyVendorId }, select: { categoryId: true } });
    for (const [i, label] of ['A', 'B'].entries()) {
      const v = await app.prisma.vendor.create({ data: { slug: `dbtest-pay-${label.toLowerCase()}-${fx.runId}`, name: `DBTEST Pay Venue ${label} ${fx.runId}`, categoryId, city: 'Patna', priceMin: 1, priceMax: 2, image: 'x', description: 'x' } });
      vendorIds.push(v.id);
      const u = await app.prisma.user.create({ data: { phone: `95000${fx.runId.replace(/\D/g, '').padEnd(4, '0').slice(0, 4)}${i}`, roles: { create: { role: 'VENDOR' } } } });
      users.push(u.id);
      await app.prisma.vendorProfile.create({ data: { userId: u.id, vendorId: v.id } });
    }
    scopeA = (await businessSvc.scopeForVendorLogin(users[0]))!;
    scopeB = (await businessSvc.scopeForVendorLogin(users[1]))!;
    await inA(() => settings.update({ confirmationPercent: '30', holdWindowDays: '5', upiId: 'dbtest@okhdfcbank', upiName: 'DBTEST Pay Venue' }));
    prefix = (await inA(() => settings.get())).numberPrefix ?? '';

    // Venue A's own couple: enquiry → quotation of ₹2,00,000 → sent → the couple accepts on their link → the booking is made.
    enquiryId = ((await inA(() => enquiries.create({ name: 'Rahul Kumar', phone: '98765 43210', weddingDate: later(60), guestCount: '300', channel: 'PHONE' }, users[0]))) as { id: string }).id;
    await inA(() => quotes.save(enquiryId, { items: [{ description: 'Hall hire', quantity: '1', unitPrice: '200000' }], validUntil: later(7) }, users[0]));
    const sent = await inA(() => quotes.send(enquiryId, users[0]));
    quotationId = sent.quotation!.id;
    const token = sent.linkPath.slice('/proposal/'.length);
    await runInScope(await scopeForProposalToken(token), () => proposalService.accept(token));
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

  test('accepted and booked: nothing received yet; ₹60,000 (30%) confirms; where to pay comes from Settings', async () => {
    const state = await inA(() => quotes.get(enquiryId));
    expect(state.quotation).toMatchObject({ stage: 'ACCEPTED', total: 200000, toConfirm: 60000, confirmationPercent: 30 });
    expect(state.quotation?.booking).toEqual({ holdWindowDays: 5, confirmed: false, received: 0, toConfirmRemaining: 60000, outstanding: 200000, stateLabel: 'No payment yet', holdOver: false, payments: [] });
    expect(state.payTo).toEqual({ upiId: 'dbtest@okhdfcbank', upiName: 'DBTEST Pay Venue' });
    expect(await nextKind()).toBe('QUOTE_ACCEPTED');
    expect(await bookingStatus()).toBe('NEW');
  });

  test('a wrong payment is explained and nothing is recorded', async () => {
    expect(await inA(() => quotes.pay(enquiryId, { amount: '0', method: 'CARD', paidOn: later(2) }, users[0]))).toEqual({ errors: { amount: expect.any(String), method: expect.any(String), paidOn: expect.any(String) } });
    expect((await outcome(inA(() => quotes.pay(enquiryId, { amount: '200001', method: 'CASH' }, users[0]))))?.name).toBe('ValidationError'); // more than is owed
    expect(await paymentCount()).toBe(0);
  });

  test('a part payment holds the date for the venue’s own 5 days — the booking is not confirmed yet', async () => {
    await inA(() => quotes.pay(enquiryId, { amount: '20,000', method: 'UPI', reference: 'UTR-DBTEST-1', idempotencyKey: `dbtest-${fx.runId}-1` }, users[0]));
    expect(await money()).toMatchObject({ confirmed: false, received: 20000, toConfirmRemaining: 40000, outstanding: 180000, stateLabel: 'Date held — 5 of 5 days left', holdOver: false, payments: [{ amount: 20000, method: 'UPI', reference: 'UTR-DBTEST-1' }] });
    expect(await bookingStatus()).toBe('NEW');
    expect(await nextKind()).toBe('QUOTE_ACCEPTED');
  });

  test('the same form sent twice, or the same reference again, is not recorded twice', async () => {
    await inA(() => quotes.pay(enquiryId, { amount: '20000', method: 'UPI', reference: 'UTR-DBTEST-1', idempotencyKey: `dbtest-${fx.runId}-1` }, users[0])); // a double tap
    expect(await paymentCount()).toBe(1);
    expect((await outcome(inA(() => quotes.pay(enquiryId, { amount: '5000', method: 'UPI', reference: 'utr-dbtest-1' }, users[0]))))?.name).toBe('ValidationError');
    expect((await money())?.received).toBe(20000);
  });

  test('another venue cannot record or see it, and Shaadi Shopping sees no payment', async () => {
    expect((await outcome(inB(() => quotes.pay(enquiryId, { amount: '1000', method: 'CASH' }, users[1]))))?.name).toBe('NotFoundError');
    expect(await inB(() => app.prisma.payment.count({ where: { invoice: { quotationId } } }))).toBe(0);
    expect(await app.prisma.payment.count({ where: { invoice: { quotationId } } })).toBe(0); // as Shaadi Shopping
    expect((await money())?.received).toBe(20000);
  });

  test('the rest of the amount to confirm arrives: the booking is confirmed — and no wedding is created', async () => {
    await inA(() => quotes.pay(enquiryId, { amount: '40000', method: 'CASH', paidOn: later(0) }, users[0]));
    expect(await money()).toMatchObject({ confirmed: true, received: 60000, toConfirmRemaining: 0, outstanding: 140000, stateLabel: 'Booking confirmed' });
    expect(await bookingStatus()).toBe('CONFIRMED');
    expect(await nextKind()).toBe('BOOKED');
    expect(await runAsSystem('test check', () => app.prisma.wedding.count({ where: { businessId: scopeA.businessId } }))).toBe(0);
    // Still the venue's open enquiry — not closed, not handed to anyone else.
    expect((await runAsSystem('test check', () => app.prisma.consultation.findUniqueOrThrow({ where: { id: enquiryId }, select: { pipelineStage: true, businessId: true } })))).toMatchObject({ businessId: scopeA.businessId });
    expect((await inA(() => enquiries.list())).find((e) => e.id === enquiryId)?.next.kind).toBe('BOOKED');
  });

  test('money after confirmation goes to the balance, on the venue’s own invoice numbers', async () => {
    await inA(() => quotes.pay(enquiryId, { amount: '100000', method: 'BANK_TRANSFER', reference: 'NEFT-DBTEST-2' }, users[0]));
    expect(await money()).toMatchObject({ confirmed: true, received: 160000, outstanding: 40000 });
    const invoices = await inA(() => app.prisma.invoice.findMany({ where: { quotationId }, select: { invoiceNumber: true, kind: true }, orderBy: { createdAt: 'asc' } }));
    expect(invoices.map((i) => i.kind)).toEqual(['ADVANCE', 'BALANCE']);
    for (const i of invoices) expect(i.invoiceNumber).toMatch(new RegExp(`^${prefix}-INV-\\d{6}-000[12]$`));
    expect(await paymentCount()).toBe(3);
  });

  test('never more than the agreed total; the last payment clears it', async () => {
    expect((await outcome(inA(() => quotes.pay(enquiryId, { amount: '40001', method: 'CASH' }, users[0]))))?.name).toBe('ValidationError');
    await inA(() => quotes.pay(enquiryId, { amount: '40000', method: 'CHEQUE', reference: '000123' }, users[0]));
    expect(await money()).toMatchObject({ confirmed: true, received: 200000, outstanding: 0 });
    expect((await outcome(inA(() => quotes.pay(enquiryId, { amount: '1', method: 'CASH' }, users[0]))))?.name).toBe('ValidationError'); // fully paid
  });

  test('a payment needs the booking: an accepted quotation without a wedding date is booked first', async () => {
    const id = ((await inA(() => enquiries.create({ name: 'Priya Singh', phone: '98765 43211', channel: 'WALK_IN' }, users[0]))) as { id: string }).id;
    await inA(() => quotes.save(id, { items: [{ description: 'Hall hire', quantity: '1', unitPrice: '100000' }], validUntil: later(7) }, users[0]));
    const token = (await inA(() => quotes.send(id, users[0]))).linkPath.slice('/proposal/'.length);
    expect((await outcome(inA(() => quotes.pay(id, { amount: '1000', method: 'CASH' }, users[0]))))?.name).toBe('ConflictError'); // not accepted yet
    await runInScope(await scopeForProposalToken(token), () => proposalService.accept(token));
    expect((await outcome(inA(() => quotes.pay(id, { amount: '1000', method: 'CASH' }, users[0]))))?.message).toContain('Make the booking first');
    await inA(() => quotes.book(id, { weddingDate: later(90) }, users[0]));
    const paid = await inA(() => quotes.pay(id, { amount: '30000', method: 'CASH' }, users[0]));
    expect('quotation' in paid && paid.quotation?.booking).toMatchObject({ confirmed: true, received: 30000, outstanding: 70000 });
  });
});
