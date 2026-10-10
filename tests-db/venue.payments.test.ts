/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runAsSystem, runInScope, type Scope } from '@/lib/ownership/scope';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Phase C: payments on a venue's OWN booking, on a real database, through the real services and two real vendor logins.
// The couple accepts venue A's quotation (30% confirms, a part payment holds the date for 5 days); the venue records what it
// receives: a part payment holds the date, the amount to confirm confirms the booking — which becomes the venue's OWN wedding, with
// the functions its quotation names — and the rest goes to the balance. Venue B and Shaadi Shopping never see any of it.
dbDescribe('payments on a venue’s own booking (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let enquiries: typeof import('@/services/venueEnquiry.service').venueEnquiryService;
  let quotes: typeof import('@/services/venueQuotation.service').venueQuotationService;
  let settings: typeof import('@/services/venueSettings.service').venueSettingsService;
  let weddings: typeof import('@/services/venueWedding.service').venueWeddingService;
  let sameDate: typeof import('@/services/venueSameDate.service').venueSameDateService;
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
  let coupleToken = '';
  // What the couple sees on their own link (it runs as the business the link belongs to, never tracking the visit here).
  const coupleView = async () => runInScope(await scopeForProposalToken(coupleToken), () => proposalService.view(coupleToken, { trackView: false }));

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
    weddings = (await import('@/services/venueWedding.service')).venueWeddingService;
    sameDate = (await import('@/services/venueSameDate.service')).venueSameDateService;
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
    await inA(() => quotes.save(enquiryId, { items: [{ description: 'Hall hire', quantity: '1', unitPrice: '150000', function: 'WEDDING' }, { description: 'Haldi decoration', quantity: '2', unitPrice: '25000', function: 'HALDI' }], validUntil: later(7) }, users[0]));
    const sent = await inA(() => quotes.send(enquiryId, users[0]));
    quotationId = sent.quotation!.id;
    const token = sent.linkPath.slice('/proposal/'.length);
    coupleToken = token;
    await runInScope(await scopeForProposalToken(token), () => proposalService.accept(token));
  });

  afterAll(async () => {
    if (!app) return;
    const ids = [scopeA?.businessId, scopeB?.businessId].filter(Boolean) as string[];
    await runAsSystem('test clean-up', async () => {
      // Same order as fixtures.purge(): agreements, invoices (payments cascade), bookings, quotations, then the couple.
      await app.prisma.commercialAgreement.deleteMany({ where: { businessId: { in: ids } } });
      await app.prisma.invoice.deleteMany({ where: { businessId: { in: ids } } });
      await app.prisma.wedding.deleteMany({ where: { businessId: { in: ids } } }); // cascades its functions, tasks and history
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
    expect(state.quotation?.booking).toEqual({ holdWindowDays: 5, confirmed: false, received: 0, toConfirmRemaining: 60000, outstanding: 200000, stateLabel: 'No payment yet', holdOver: false, payments: [], invoices: [{ number: expect.any(String), kind: 'ADVANCE', taxable: 60000, gst: 0, total: 60000, paid: 0, gstin: null }], claims: [] });
    expect(state.payTo).toEqual({ upiId: 'dbtest@okhdfcbank', upiName: 'DBTEST Pay Venue' });
    expect(await nextKind()).toBe('QUOTE_ACCEPTED');
    expect(await bookingStatus()).toBe('NEW');
    // The couple's link: the booking, what confirms it, no wedding yet — and where to pay is the VENUE's own UPI.
    const couple = await coupleView();
    expect(couple?.yourBooking).toEqual({ confirmed: false, total: 200000, received: 0, outstanding: 200000, toConfirm: 60000, payments: [], wedding: null });
    expect(couple?.payments).toMatchObject({ upi: { vpa: 'dbtest@okhdfcbank', payee: 'DBTEST Pay Venue' }, payNow: 60000, received: 0, inReview: 0, submissions: [], receipts: [], canSubmit: true });
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

  test('a part payment makes no wedding, and "Create the wedding" is refused', async () => {
    expect(await runAsSystem('test check', () => app.prisma.wedding.count({ where: { businessId: scopeA.businessId } }))).toBe(0);
    expect((await inA(() => quotes.get(enquiryId))).quotation).toMatchObject({ wedding: null, canCreateWedding: false });
    expect((await outcome(inA(() => quotes.createWedding(enquiryId))))?.message).toContain('not confirmed yet');
    expect(await inA(() => weddings.list())).toEqual([]);
  });

  test('the rest of the amount to confirm arrives: the booking is confirmed — and becomes the venue’s own wedding', async () => {
    await inA(() => quotes.pay(enquiryId, { amount: '40000', method: 'CASH', paidOn: later(0) }, users[0]));
    expect(await money()).toMatchObject({ confirmed: true, received: 60000, toConfirmRemaining: 0, outstanding: 140000, stateLabel: 'Booking confirmed' });
    expect(await bookingStatus()).toBe('CONFIRMED');
    expect(await nextKind()).toBe('BOOKED');
    const all = await runAsSystem('test check', () => app.prisma.wedding.findMany({ where: { sourceBooking: { quotationId } }, select: { id: true, businessId: true, weddingNumber: true, status: true } }));
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ businessId: scopeA.businessId, status: 'PLANNING' });
    expect(all[0].weddingNumber).toMatch(new RegExp(`^${prefix}-WED-\\d{4}-0001$`));
    expect((await inA(() => quotes.get(enquiryId))).quotation).toMatchObject({ wedding: { id: all[0].id, number: all[0].weddingNumber }, canCreateWedding: false });
    // Still the venue's open enquiry — not closed, not handed to anyone else.
    expect((await runAsSystem('test check', () => app.prisma.consultation.findUniqueOrThrow({ where: { id: enquiryId }, select: { pipelineStage: true, businessId: true } })))).toMatchObject({ businessId: scopeA.businessId });
    expect((await inA(() => enquiries.list())).find((e) => e.id === enquiryId)?.next.kind).toBe('BOOKED');
  });

  test('the wedding: the functions the quotation names, what was agreed, the money — and nothing about finding a vendor', async () => {
    const [item] = await inA(() => weddings.list());
    expect(item).toMatchObject({ customerName: 'Rahul Kumar', date: later(60), guestCount: 300, stage: 'PLANNING', stageLabel: 'Planning', functions: ['Haldi', 'Wedding'] });
    const w = await inA(() => weddings.get(item.id));
    expect(w).toMatchObject({ enquiryId, city: 'Patna', moneyHidden: false, money: { total: 200000, received: 60000, outstanding: 140000 } });
    expect(w.functionList.map((f) => [f.type, f.date])).toEqual([['HALDI', later(60)], ['WEDDING', later(60)]]);
    expect(w.agreed).toEqual([
      { description: 'Hall hire', quantity: 1, unitPrice: 150000, lineTotal: 150000, function: 'Wedding' },
      { description: 'Haldi decoration', quantity: 2, unitPrice: 25000, lineTotal: 50000, function: 'Haldi' },
    ]);
    expect(w.agreedTotals).toEqual({ discount: 0, gst: 0, total: 200000 });
    // The business provides its own lines: no vendor booking, no "assign a vendor" task.
    expect(w.tasks).toEqual([]);
    expect(await runAsSystem('test check', () => app.prisma.vendorBooking.count({ where: { weddingEvent: { weddingId: item.id } } }))).toBe(0);
    // Every record of the wedding belongs to venue A; the agreement's invoice and its payments moved to the wedding untouched.
    const owned = await runAsSystem('test check', () => app.prisma.invoice.findMany({ where: { quotationId }, select: { weddingId: true, businessId: true } }));
    expect(owned.length).toBeGreaterThan(0);
    expect(owned.every((i) => i.weddingId === item.id && i.businessId === scopeA.businessId)).toBe(true);
    expect(await paymentCount()).toBe(2);
    expect(await runAsSystem('test check', () => app.prisma.commercialAgreement.count({ where: { quotationId } }))).toBe(1);
  });

  test('a manager without money permission sees the wedding, not the money', async () => {
    const { effectivePermissions } = await import('@/lib/auth/permissions');
    const manager = { ...scopeA, role: 'MANAGER' as const, permissions: effectivePermissions({ role: 'MANAGER', grants: [] }) };
    const [item] = await runInScope(manager, () => weddings.list());
    expect(await runInScope(manager, () => weddings.get(item.id))).toMatchObject({ customerName: 'Rahul Kumar', money: null, moneyHidden: true });
  });

  test('"Create the wedding" again keeps the one wedding', async () => {
    await inA(() => quotes.createWedding(enquiryId));
    await inA(() => quotes.createWedding(enquiryId));
    expect(await runAsSystem('test check', () => app.prisma.wedding.count({ where: { businessId: scopeA.businessId } }))).toBe(1);
    expect(await runAsSystem('test check', () => app.prisma.weddingEvent.count({ where: { wedding: { businessId: scopeA.businessId } } }))).toBe(2);
  });

  test('another venue and Shaadi Shopping never see the wedding', async () => {
    const [item] = await inA(() => weddings.list());
    expect(await inB(() => weddings.list())).toEqual([]);
    expect((await outcome(inB(() => weddings.get(item.id))))?.name).toBe('NotFoundError');
    expect((await outcome(inB(() => quotes.createWedding(enquiryId))))?.name).toBe('NotFoundError');
    expect(await app.prisma.wedding.count({ where: { id: item.id } })).toBe(0); // as Shaadi Shopping
    expect(await app.prisma.weddingEvent.count({ where: { weddingId: item.id } })).toBe(0);
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

  test('the couple’s link shows their wedding and what was received — no reference numbers, and nothing of another couple', async () => {
    const couple = await coupleView();
    expect(couple?.yourBooking).toMatchObject({ confirmed: true, total: 200000, received: 200000, outstanding: 0, toConfirm: 0 });
    expect(couple?.yourBooking?.payments.map((p) => [p.amount, p.method])).toEqual(expect.arrayContaining([[20000, 'UPI'], [40000, 'Cash'], [100000, 'Bank transfer'], [40000, 'Cheque']]));
    expect(couple?.yourBooking?.payments).toHaveLength(4);
    expect(couple?.yourBooking?.wedding).toMatchObject({ date: later(60), state: 'UPCOMING', daysToGo: 60, functions: ['Haldi', 'Wedding'] });
    expect(couple?.yourBooking?.wedding?.number).toMatch(new RegExp(`^${prefix}-WED-\\d{4}-0001$`));
    const text = JSON.stringify(couple);
    for (const hidden of ['UTR-DBTEST-1', 'NEFT-DBTEST-2', '000123', scopeA.businessId]) expect(text).not.toContain(hidden);
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
    // A quotation whose lines name no function gives the one "Wedding" function; the venue's wedding numbers run on.
    expect('quotation' in paid && paid.quotation?.wedding?.number).toMatch(new RegExp(`^${prefix}-WED-\\d{4}-0002$`));
    const second = (await inA(() => weddings.list())).find((w) => w.customerName === 'Priya Singh');
    expect(second).toMatchObject({ date: later(90), functions: ['Wedding'] });
  });

  test('the venue plans its own wedding: a function gets its day, time and place; one is added; the couple’s link shows the schedule', async () => {
    const [rahul] = (await inA(() => weddings.list())).filter((w) => w.customerName === 'Rahul Kumar');
    const before = await inA(() => weddings.get(rahul.id));
    expect(before.canEdit).toBe(true);
    const haldi = before.functionList.find((f) => f.type === 'HALDI')!;
    // What is wrong is said, and nothing is saved.
    expect(await inA(() => weddings.updateFunction(rahul.id, haldi.id, { type: 'HALDI', date: 'soon', startTime: '6pm' }, users[0]))).toEqual({ errors: { date: expect.any(String), startTime: expect.any(String) } });
    const moved = (await inA(() => weddings.updateFunction(rahul.id, haldi.id, { type: 'HALDI', date: later(59), startTime: '10:30', place: 'Main lawn' }, users[0]))) as typeof before;
    expect(moved.functionList.find((f) => f.id === haldi.id)).toMatchObject({ name: 'Haldi', date: later(59), startTime: '10:30', place: 'Main lawn' });
    expect(moved.date).toBe(later(60)); // the wedding's own date follows its "Wedding" function, not the Haldi
    const added = (await inA(() => weddings.addFunction(rahul.id, { type: 'OTHER', label: 'Tilak', date: later(58) }, users[0]))) as typeof before;
    expect(added.functionList.map((f) => [f.name, f.date])).toEqual([['Tilak', later(58)], ['Haldi', later(59)], ['Wedding', later(60)]]);
    expect(await runAsSystem('test check', () => app.prisma.weddingEvent.count({ where: { weddingId: rahul.id, wedding: { businessId: scopeA.businessId } } }))).toBe(3);
    // The couple sees the days on their link; the quotation and the money are untouched.
    const couple = await coupleView();
    expect(couple?.yourBooking?.wedding).toMatchObject({ planned: true, schedule: [{ name: 'Tilak', date: later(58), time: null, place: null }, { name: 'Haldi', date: later(59), time: '10:30', place: 'Main lawn' }, { name: 'Wedding', date: later(60), time: null, place: null }] });
    expect(couple?.yourBooking).toMatchObject({ total: 200000, received: 200000 });
    expect(await paymentCount()).toBe(4);
    // Removing: an empty function goes; the last one never does.
    const tilak = added.functionList.find((f) => f.name === 'Tilak')!;
    expect((await inA(() => weddings.removeFunction(rahul.id, tilak.id, users[0]))).functionList).toHaveLength(2);
    const [priya] = (await inA(() => weddings.list())).filter((w) => w.customerName === 'Priya Singh');
    const only = (await inA(() => weddings.get(priya.id))).functionList[0];
    expect((await outcome(inA(() => weddings.removeFunction(priya.id, only.id, users[0]))))?.message).toContain('at least one function');
  });

  test('moving the "Wedding" function moves the wedding’s date', async () => {
    const [priya] = (await inA(() => weddings.list())).filter((w) => w.customerName === 'Priya Singh');
    const only = (await inA(() => weddings.get(priya.id))).functionList[0];
    const moved = (await inA(() => weddings.updateFunction(priya.id, only.id, { type: 'WEDDING', date: later(91) }, users[0]))) as { date: string };
    expect(moved.date).toBe(later(91));
    await inA(() => weddings.updateFunction(priya.id, only.id, { type: 'WEDDING', date: later(90) }, users[0])); // back, for the tests below
  });

  test('the to-do list: add, tick, untick, take off — and it stays the venue’s own', async () => {
    const [rahul] = (await inA(() => weddings.list())).filter((w) => w.customerName === 'Rahul Kumar');
    expect(await inA(() => weddings.addTask(rahul.id, { title: ' ' }, users[0]))).toEqual({ errors: { title: expect.any(String) } });
    const one = (await inA(() => weddings.addTask(rahul.id, { title: 'Confirm the generator', dueOn: later(50) }, users[0]))) as Awaited<ReturnType<typeof weddings.get>>;
    expect(one.tasks).toEqual([{ id: expect.any(String), title: 'Confirm the generator', done: false, dueAt: expect.any(String), dueOn: later(50) }]);
    const taskId = one.tasks[0].id;
    expect(await runAsSystem('test check', () => app.prisma.task.findUniqueOrThrow({ where: { id: taskId }, select: { context: true, weddingId: true, wedding: { select: { businessId: true } } } }))).toEqual({ context: 'WEDDING_TASK', weddingId: rahul.id, wedding: { businessId: scopeA.businessId } });
    expect((await inA(() => weddings.setTask(rahul.id, taskId, { done: true }))).tasks[0].done).toBe(true);
    expect((await inA(() => weddings.setTask(rahul.id, taskId, { done: false }))).tasks[0].done).toBe(false);
    // Another venue cannot see, add to or change any of it; Shaadi Shopping does not see the task.
    expect((await outcome(inB(() => weddings.addTask(rahul.id, { title: 'x' }, users[1]))))?.name).toBe('NotFoundError');
    expect((await outcome(inB(() => weddings.setTask(rahul.id, taskId, { done: true }))))?.name).toBe('NotFoundError');
    expect((await outcome(inB(() => weddings.addFunction(rahul.id, { type: 'HALDI', date: later(59) }, users[1]))))?.name).toBe('NotFoundError');
    expect(await app.prisma.task.count({ where: { id: taskId } })).toBe(0); // as Shaadi Shopping
    expect((await inA(() => weddings.get(rahul.id))).tasks[0].done).toBe(false);
    expect((await inA(() => weddings.setTask(rahul.id, taskId, { remove: true }))).tasks).toEqual([]);
    expect(await runAsSystem('test check', () => app.prisma.task.findUniqueOrThrow({ where: { id: taskId }, select: { status: true } }))).toEqual({ status: 'CANCELLED' }); // kept, never deleted
  });

  test('a member who may not work on weddings cannot change the plan from the page', async () => {
    const { effectivePermissions } = await import('@/lib/auth/permissions');
    const [rahul] = (await inA(() => weddings.list())).filter((w) => w.customerName === 'Rahul Kumar');
    const staff = { ...scopeA, role: 'STAFF' as const, permissions: effectivePermissions({ role: 'STAFF', grants: [] }) };
    expect((await runInScope(staff, () => weddings.get(rahul.id))).canEdit).toBe(staff.permissions.includes('weddings'));
  });

  test('the same-date warning: a new enquiry for a date the venue is already booked on is told who has it', async () => {
    const [rahul] = await inA(() => weddings.list());
    const id = ((await inA(() => enquiries.create({ name: 'Asha Verma', phone: '98765 43212', weddingDate: later(60), channel: 'PHONE' }, users[0]))) as { id: string }).id;
    expect(await inA(() => sameDate.forEnquiry(id))).toEqual({ date: later(60), bookings: [{ name: 'Rahul Kumar', confirmed: true, enquiryId, wedding: { id: rahul.id, number: rahul.number } }] });
    // A booking never warns about itself; a free date warns about nothing.
    expect(await inA(() => sameDate.forEnquiry(enquiryId))).toEqual({ date: later(60), bookings: [] });
    expect((await inA(() => sameDate.forEnquiry(id, later(61)))).bookings).toEqual([]);
    // It is a warning only: the quotation is still made, sent and accepted — and the first couple's enquiry now shows the second.
    await inA(() => quotes.save(id, { items: [{ description: 'Hall hire', quantity: '1', unitPrice: '100000' }], validUntil: later(7) }, users[0]));
    const token = (await inA(() => quotes.send(id, users[0]))).linkPath.slice('/proposal/'.length);
    await runInScope(await scopeForProposalToken(token), () => proposalService.accept(token));
    expect((await inA(() => sameDate.forEnquiry(enquiryId))).bookings).toEqual([{ name: 'Asha Verma', confirmed: false, enquiryId: id, wedding: null }]);
  });

  test('the same-date warning: no date yet checks the date being picked; another venue is never counted or told', async () => {
    const id = ((await inA(() => enquiries.create({ name: 'Neha Jha', phone: '98765 43213', channel: 'WALK_IN' }, users[0]))) as { id: string }).id;
    expect(await inA(() => sameDate.forEnquiry(id))).toEqual({ date: null, bookings: [] });
    expect((await inA(() => sameDate.forEnquiry(id, later(90)))).bookings.map((b) => [b.name, b.confirmed])).toEqual([['Priya Singh', true]]);
    expect(await inA(() => sameDate.forEnquiry(id, 'next week'))).toEqual({ date: null, bookings: [] });
    const other = ((await inB(() => enquiries.create({ name: 'Other Couple', phone: '98765 43214', weddingDate: later(60), channel: 'PHONE' }, users[1]))) as { id: string }).id;
    expect(await inB(() => sameDate.forEnquiry(other))).toEqual({ date: later(60), bookings: [] });
    expect((await outcome(inB(() => sameDate.forEnquiry(enquiryId))))?.name).toBe('NotFoundError');
  });

  // ---- the couple pays the venue from their link, and the venue checks it ----
  let claimEnquiry = '';
  let claimQuotation = '';
  let claimToken = '';
  const claimLink = async <T>(fn: () => Promise<T>) => runInScope(await scopeForProposalToken(claimToken), fn);
  const claimMoney = async () => (await inA(() => quotes.get(claimEnquiry))).quotation?.booking;
  const claimPayments = () => inA(() => app.prisma.payment.count({ where: { invoice: { quotationId: claimQuotation } } }));

  test('paying the venue from the link needs the booking: before it, the couple is pointed to the venue', async () => {
    claimEnquiry = ((await inA(() => enquiries.create({ name: 'Anita Verma', phone: '98765 43212', channel: 'WALK_IN' }, users[0]))) as { id: string }).id;
    await inA(() => quotes.save(claimEnquiry, { items: [{ description: 'Hall hire', quantity: '1', unitPrice: '100000' }], validUntil: later(7) }, users[0]));
    const sent = await inA(() => quotes.send(claimEnquiry, users[0]));
    claimQuotation = sent.quotation!.id;
    claimToken = sent.linkPath.slice('/proposal/'.length);
    await claimLink(() => proposalService.accept(claimToken)); // no wedding date yet, so no booking
    expect((await claimLink(() => proposalService.view(claimToken, { trackView: false })))?.payments).toBeNull();
    expect((await outcome(claimLink(() => proposalService.submitPayment(claimToken, { amount: '30000', utr: '412345678901' }, null))))?.message).toContain('Please contact');
    await inA(() => quotes.book(claimEnquiry, { weddingDate: later(120) }, users[0]));
    const view = await claimLink(() => proposalService.view(claimToken, { trackView: false }));
    expect(view?.payments).toMatchObject({ upi: { vpa: 'dbtest@okhdfcbank', payee: 'DBTEST Pay Venue' }, total: 100000, payNow: 30000, canSubmit: true });
  });

  test('"I have paid" is a claim, never money: nothing is received, held or confirmed until the venue finds it', async () => {
    const sent = await claimLink(() => proposalService.submitPayment(claimToken, { amount: '30,000', utr: '4123 4567 8901' }, null));
    expect(sent.payments).toMatchObject({ received: 0, inReview: 30000, submissions: [{ amount: 30000, utr: '412345678901', status: 'PENDING' }] });
    expect(await claimMoney()).toMatchObject({ confirmed: false, received: 0, stateLabel: 'No payment yet', payments: [], claims: [{ amount: 30000, utr: '412345678901', status: 'PENDING', proofUrl: null }] });
    expect(await claimPayments()).toBe(0);
    // The venue's list puts it first.
    expect((await inA(() => enquiries.get(claimEnquiry))).next).toEqual({ kind: 'PAYMENT_TO_CHECK', label: 'Anita says they have paid — check and confirm it' });
    expect((await inA(() => enquiries.list()))[0]).toMatchObject({ id: claimEnquiry, next: { kind: 'PAYMENT_TO_CHECK' } });
    // … and the menu carries the count.
    expect(await inA(() => enquiries.paymentsToCheck())).toBe(1);
    // The same reference is not taken twice.
    expect((await outcome(claimLink(() => proposalService.submitPayment(claimToken, { amount: '30000', utr: '412345678901' }, null))))?.name).toBe('ConflictError');
  });

  test('the claim is the venue’s own: a manager without money permission, another venue and Shaadi Shopping do not see or check it', async () => {
    const { effectivePermissions } = await import('@/lib/auth/permissions');
    const manager = { ...scopeA, role: 'MANAGER' as const, permissions: effectivePermissions({ role: 'MANAGER', grants: [] }) };
    const asManager = await runInScope(manager, async () => ({ enquiry: await enquiries.get(claimEnquiry), quote: await quotes.get(claimEnquiry) }));
    expect(asManager.enquiry.next.kind).toBe('QUOTE_ACCEPTED');
    expect(JSON.stringify(asManager)).not.toContain('412345678901');
    expect(await runInScope(manager, () => enquiries.paymentsToCheck())).toBe(0);
    expect(await inB(() => enquiries.paymentsToCheck())).toBe(0);
    const claimId = (await claimMoney())!.claims[0].id;
    expect((await outcome(inB(() => quotes.checkClaim(claimEnquiry, claimId, { received: true }, users[1]))))?.name).toBe('NotFoundError');
    expect(await inB(() => app.prisma.paymentSubmission.count({ where: { quotationId: claimQuotation } }))).toBe(0);
    expect(await app.prisma.paymentSubmission.count({ where: { quotationId: claimQuotation } })).toBe(0); // as Shaadi Shopping
    expect(await claimPayments()).toBe(0);
  });

  test('not found: the couple reads the venue’s reason on their link, and nothing is counted', async () => {
    await claimLink(() => proposalService.submitPayment(claimToken, { amount: '5000', utr: '999999999999' }, null));
    const wrong = (await claimMoney())!.claims.find((c) => c.utr === '999999999999')!;
    expect((await outcome(inA(() => quotes.checkClaim(claimEnquiry, wrong.id, { received: false, reason: ' ' }, users[0]))))?.name).toBe('ValidationError');
    await inA(() => quotes.checkClaim(claimEnquiry, wrong.id, { received: false, reason: 'We cannot find this reference in our account' }, users[0]));
    const view = await claimLink(() => proposalService.view(claimToken, { trackView: false }));
    expect(view?.payments?.submissions.find((x) => x.utr === '999999999999')).toMatchObject({ status: 'REJECTED', rejectReason: 'We cannot find this reference in our account' });
    expect(view?.payments).toMatchObject({ received: 0, inReview: 30000 });
    expect(await claimPayments()).toBe(0);
    // A claim marked as not found cannot be counted afterwards.
    expect((await outcome(inA(() => quotes.checkClaim(claimEnquiry, wrong.id, { received: true }, users[0]))))?.name).toBe('ConflictError');
  });

  test('found: the venue says it received the money — the payment is recorded once, the booking confirms and becomes its wedding', async () => {
    const claim = (await claimMoney())!.claims.find((c) => c.status === 'PENDING')!;
    const after = await inA(() => quotes.checkClaim(claimEnquiry, claim.id, { received: true }, users[0]));
    expect(after.quotation?.booking).toMatchObject({ confirmed: true, received: 30000, outstanding: 70000, stateLabel: 'Booking confirmed', payments: [{ amount: 30000, method: 'UPI', reference: '412345678901' }] });
    expect(after.quotation?.booking?.claims.map((c) => c.status)).toEqual(['REJECTED']);
    expect(after.quotation?.wedding?.number).toContain(prefix + '-WED-');
    // Pressed again (a double tap, a second person): still one payment.
    await inA(() => quotes.checkClaim(claimEnquiry, claim.id, { received: true }, users[0]));
    expect(await claimPayments()).toBe(1);
    expect((await claimMoney())?.received).toBe(30000);
    expect((await inA(() => enquiries.get(claimEnquiry))).next.kind).toBe('BOOKED');
    expect(await inA(() => enquiries.paymentsToCheck())).toBe(0); // one found, one not found: nothing left to check
    // The couple's link: confirmed, with their receipt; and the venue's wedding carries their name.
    const view = await claimLink(() => proposalService.view(claimToken, { trackView: false }));
    expect(view?.payments).toMatchObject({ bookingConfirmed: true, received: 30000, inReview: 0, outstanding: 70000, receipts: [{ amount: 30000, method: 'UPI', reference: null }] });
    expect(view?.yourBooking).toMatchObject({ confirmed: true, received: 30000, wedding: { date: later(120) } });
    expect((await inA(() => weddings.list())).some((w) => w.customerName === 'Anita Verma')).toBe(true);
    // Still nothing for another venue or Shaadi Shopping.
    expect(await inB(() => app.prisma.payment.count({ where: { invoice: { quotationId: claimQuotation } } }))).toBe(0);
    expect(await app.prisma.payment.count({ where: { invoice: { quotationId: claimQuotation } } })).toBe(0);
  });
});
