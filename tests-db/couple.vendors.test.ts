/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, tally, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Client OS → Vendors (22 Nov 2026) on a real database, on a Shaadi Shopping wedding shaped like WED-2026-0002.
// Outside vendors stay the couple's own records (never a VendorBooking, payout or commission). "Ask for a quote" makes one request per
// vendor, a task for the coordinator, and an answer the couple reads.
dbDescribe('Couple vendors and quote requests (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let svc: typeof import('@/services/coupleVendors.service').coupleVendorsService;
  let asCouple: typeof import('@/lib/customer/coupleEntry').asCoupleWedding;
  let fnSvc: typeof import('@/services/coupleFunctions.service').coupleFunctionsService;
  const users: string[] = [];
  let couple = '';
  let stranger = '';
  let coordinator = '';
  let weddingId = '';
  let vendorA = '';
  let vendorB = '';
  let draftVendor = '';
  let originalStatus: { id: string; status: 'DRAFT' | 'PENDING_VERIFICATION' | 'PUBLISHED' }[] = [];

  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;
  const vendorBookings = () => app.prisma.vendorBooking.count({ where: { weddingEvent: { weddingId } } });

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    svc = (await import('@/services/coupleVendors.service')).coupleVendorsService;
    asCouple = (await import('@/lib/customer/coupleEntry')).asCoupleWedding;
    fnSvc = (await import('@/services/coupleFunctions.service')).coupleFunctionsService;
    for (const name of ['couple', 'stranger', 'coordinator']) users.push((await app.prisma.user.create({ data: { name: `DBTEST ${name} ${fx.runId}`, phone: `96${String(Date.now()).slice(-7)}${users.length}` } })).id);
    [couple, stranger, coordinator] = users;
    const vendors = await fx.vendors(3);
    [vendorA, vendorB, draftVendor] = vendors.map((v) => v.id);
    originalStatus = await app.prisma.vendor.findMany({ where: { id: { in: [vendorA, vendorB, draftVendor] } }, select: { id: true, status: true } });
    // two listed vendors, and one that is not listed (draft) — the couple must not be able to ask for that one
    await app.prisma.vendor.updateMany({ where: { id: { in: [vendorA, vendorB] } }, data: { status: 'PUBLISHED' } });
    await app.prisma.vendor.update({ where: { id: draftVendor }, data: { status: 'DRAFT' } });
    const c = await fx.consultation({ name: 'DBTEST couple vendors', weddingDate: '2027-01-20', guestCount: 200 });
    const q = await fx.acceptedQuote(c.id, { items: [fx.line('Decoration package', 85500, 1, undefined, 'Decorators')], advance: 5000 });
    const booking = await app.quotationService.createBooking(q.id, {}, null);
    await app.commercialFlow.recordPaymentForQuotation(q.id, { amount: 21375, method: 'UPI' }, null);
    weddingId = (await app.prisma.wedding.findFirstOrThrow({ where: { sourceBookingId: booking.id } })).id;
    await app.prisma.wedding.update({ where: { id: weddingId }, data: { customerId: couple, coordinatorId: coordinator } });
  });
  afterAll(async () => {
    if (fx) await fx.purge(); // the wedding goes, and its couple vendors / requests with it (cascade)
    if (app) {
      for (const v of originalStatus) await app.prisma.vendor.update({ where: { id: v.id }, data: { status: v.status } });
      if (users.length) await app.prisma.user.deleteMany({ where: { id: { in: users } } });
    }
  });

  test('an outside vendor is the couple’s own record — never a vendor booking — and is in the history', async () => {
    const before = await vendorBookings();
    const v = await asCouple(weddingId, couple, () => svc.addOwn(weddingId, { name: 'Raju Photo Studio', category: 'Photographer', phone: '+91 98765 43210', price: 45000, notes: 'Candid' }, couple));
    expect(v).toMatchObject({ name: 'Raju Photo Studio', phone: '9876543210', price: 45000, createdById: couple });
    expect(await vendorBookings()).toBe(before);
    const log = await app.prisma.activityLog.findFirst({ where: { weddingId, summary: { contains: 'Raju Photo Studio' } } });
    expect(log?.summary).toContain('not a Shaadi Shopping partner');
    expect(log?.performedById).toBe(couple);
    const changed = await asCouple(weddingId, couple, () => svc.updateOwn(weddingId, v.id, { name: 'Raju Photo Studio', category: 'Photographer', phone: null, price: 40000 }, couple));
    expect(changed).toMatchObject({ phone: null, price: 40000 });
    expect((await errorOf(asCouple(weddingId, couple, () => svc.addOwn(weddingId, { name: 'X', category: 'Y', phone: '12345' }, couple))))?.name).toBe('ValidationError');
  });

  test('someone else’s wedding, and a function of another wedding, are refused', async () => {
    expect((await errorOf(asCouple(weddingId, stranger, () => svc.addOwn(weddingId, { name: 'X', category: 'Y' }, stranger))))?.name).toBe('NotFoundError');
    const other = await app.prisma.weddingEvent.findFirst({ where: { weddingId: { not: weddingId } }, select: { id: true } });
    if (other) expect((await errorOf(asCouple(weddingId, couple, () => svc.addOwn(weddingId, { name: 'X', category: 'Y', weddingEventId: other.id }, couple))))?.message).toContain('your functions');
  });

  test('searching shows listed vendors only, with listing facts and never the owner’s contact details', async () => {
    const cat = await app.prisma.vendor.findUniqueOrThrow({ where: { id: vendorA }, select: { category: { select: { slug: true } } } });
    const found = await asCouple(weddingId, couple, () => svc.searchListed(weddingId, cat.category.slug));
    const ids = found.vendors.map((v) => v.id);
    expect(ids).not.toContain(draftVendor);
    for (const v of found.vendors) {
      expect(v).not.toHaveProperty('ownerPhone');
      expect(v).not.toHaveProperty('ownerEmail');
    }
  });

  test('asking for a quote: one request, a task for the coordinator; asking again (even twice at once) changes nothing', async () => {
    const r1 = await asCouple(weddingId, couple, () => svc.requestQuote(weddingId, { vendorId: vendorA, note: 'Both days please' }, couple));
    expect(r1.status).toBe('REQUESTED');
    const again = await Promise.allSettled([
      asCouple(weddingId, couple, () => svc.requestQuote(weddingId, { vendorId: vendorA }, couple)),
      asCouple(weddingId, couple, () => svc.requestQuote(weddingId, { vendorId: vendorA }, couple)),
    ]);
    expect(tally(again)).toMatchObject({ ok: 2, other: [] });
    expect(await app.prisma.vendorQuoteRequest.count({ where: { weddingId, vendorId: vendorA } })).toBe(1);
    const vendorName = (await app.prisma.vendor.findUniqueOrThrow({ where: { id: vendorA } })).name;
    const tasks = await app.prisma.task.findMany({ where: { weddingId, title: `Couple asked for a quote: ${vendorName}` } });
    expect(tasks.length).toBe(1);
    expect(tasks[0]).toMatchObject({ assignedToId: coordinator, status: 'PENDING' });
    expect(tasks[0].description).toContain('Both days please');

    // two first-time asks for another vendor at the same moment → one request
    const both = await Promise.allSettled([
      asCouple(weddingId, couple, () => svc.requestQuote(weddingId, { vendorId: vendorB }, couple)),
      asCouple(weddingId, couple, () => svc.requestQuote(weddingId, { vendorId: vendorB }, couple)),
    ]);
    expect(tally(both).other).toEqual([]);
    expect(await app.prisma.vendorQuoteRequest.count({ where: { weddingId, vendorId: vendorB } })).toBe(1);

    expect((await errorOf(asCouple(weddingId, couple, () => svc.requestQuote(weddingId, { vendorId: draftVendor }, couple))))?.message).toContain('not listed');
  });

  test('staff answer: a stale view is refused, a price needs words, the coordinator’s task is done; the couple sees it', async () => {
    const r = await app.prisma.vendorQuoteRequest.findFirstOrThrow({ where: { weddingId, vendorId: vendorA } });
    expect((await errorOf(svc.answer(weddingId, r.id, { status: 'QUOTED', staffNote: '₹45,000', seenUpdatedAt: new Date(r.updatedAt.getTime() - 1000).toISOString() }, null)))?.name).toBe('ConflictError');
    expect((await errorOf(svc.answer(weddingId, r.id, { status: 'QUOTED', staffNote: ' ', seenUpdatedAt: r.updatedAt.toISOString() }, null)))?.name).toBe('ValidationError');
    const quoted = await svc.answer(weddingId, r.id, { status: 'QUOTED', staffNote: '₹45,000 for both days, 2 photographers', seenUpdatedAt: r.updatedAt.toISOString() }, coordinator);
    expect(quoted).toMatchObject({ status: 'QUOTED', handledById: coordinator });
    const vendorName = (await app.prisma.vendor.findUniqueOrThrow({ where: { id: vendorA } })).name;
    expect((await app.prisma.task.findFirstOrThrow({ where: { weddingId, title: `Couple asked for a quote: ${vendorName}` } })).status).toBe('DONE');
    const [event] = await app.clientPortalService.getEventsForClient(couple);
    expect(event.quoteRequests.find((q) => q.id === r.id)).toMatchObject({ status: 'QUOTED', staffNote: '₹45,000 for both days, 2 photographers' });
    expect(event.ownVendors.map((o) => o.name)).toContain('Raju Photo Studio');
    expect(event.canAskForQuotes).toBe(true);
  });

  test('not available → the couple asks again → it starts again with a fresh task; the couple can close a request', async () => {
    const r = await app.prisma.vendorQuoteRequest.findFirstOrThrow({ where: { weddingId, vendorId: vendorB } });
    const na = await svc.answer(weddingId, r.id, { status: 'NOT_AVAILABLE', staffNote: 'Booked elsewhere that day', seenUpdatedAt: r.updatedAt.toISOString() }, null);
    expect(na.status).toBe('NOT_AVAILABLE');
    const reopened = await asCouple(weddingId, couple, () => svc.requestQuote(weddingId, { vendorId: vendorB, note: 'Any other date?' }, couple));
    expect(reopened).toMatchObject({ id: r.id, status: 'REQUESTED', staffNote: null, note: 'Any other date?' });
    const closed = await asCouple(weddingId, couple, () => svc.closeRequest(weddingId, r.id, couple));
    expect(closed.status).toBe('CLOSED');
    const vendorName = (await app.prisma.vendor.findUniqueOrThrow({ where: { id: vendorB } })).name;
    const open = await app.prisma.task.count({ where: { weddingId, title: `Couple asked for a quote: ${vendorName}`, status: { in: ['PENDING', 'IN_PROGRESS'] } } });
    expect(open).toBe(0);
  });

  test('one enquiry can cover several functions and stays an enquiry until a real booking exists', async () => {
    const haldi = await asCouple(weddingId, couple, () => fnSvc.add(weddingId, { type: 'HALDI', date: '2027-01-18', place: 'ELSEWHERE', venueName: 'Home' }, couple));
    const main = await app.prisma.weddingEvent.findFirstOrThrow({ where: { weddingId, type: 'WEDDING' } });
    const before = await vendorBookings();
    const old = await app.prisma.vendorQuoteRequest.findFirst({ where: { weddingId, vendorId: vendorA } });
    if (old) await app.prisma.vendorQuoteRequest.delete({ where: { id: old.id } });
    const r = await asCouple(weddingId, couple, () => svc.requestQuote(weddingId, { vendorId: vendorA, weddingEventIds: [haldi.id, main.id, haldi.id] }, couple));
    expect(r.status).toBe('REQUESTED');
    const links = () => app.prisma.vendorQuoteFunction.findMany({ where: { requestId: r.id } }).then((x) => x.map((l) => l.weddingEventId).sort());
    expect(await links()).toEqual([haldi.id, main.id].sort());
    expect(await vendorBookings()).toBe(before); // an enquiry never makes a booking
    const other = await app.prisma.weddingEvent.findFirst({ where: { weddingId: { not: weddingId } }, select: { id: true } });
    if (other) expect((await errorOf(asCouple(weddingId, couple, () => svc.setRequestFunctions(weddingId, r.id, [other.id], couple))))?.message).toContain('your functions');
    const changed = await asCouple(weddingId, couple, () => svc.setRequestFunctions(weddingId, r.id, [haldi.id], couple));
    expect(await links()).toEqual([haldi.id]);
    expect((await errorOf(svc.answer(weddingId, r.id, { status: 'BOOKED', seenUpdatedAt: changed.updatedAt.toISOString() }, null)))?.message).toContain('not a booking');
    expect((await app.prisma.vendorQuoteRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('REQUESTED');
    const [event] = await app.clientPortalService.getEventsForClient(couple);
    expect(event.quoteRequests.find((q) => q.id === r.id)?.functionIds).toEqual([haldi.id]);
    await app.prisma.vendorQuoteRequest.delete({ where: { id: r.id } });
    await app.prisma.weddingEvent.delete({ where: { id: haldi.id } });
  });

  test('removing an own vendor', async () => {
    const v = await app.prisma.coupleVendor.findFirstOrThrow({ where: { weddingId } });
    expect(await asCouple(weddingId, couple, () => svc.removeOwn(weddingId, v.id, couple))).toEqual({ removed: true });
    expect(await app.prisma.coupleVendor.count({ where: { id: v.id } })).toBe(0);
  });
});
