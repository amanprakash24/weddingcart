/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Couple-controlled functions (22 Nov 2026) on a real database, on a wedding shaped like WED-2026-0002 (Shaadi Shopping, made from a
// booking once 25 % was paid). The couple adds and edits their own functions; one at the booked venue waits for staff. Nothing the
// couple does may change the booking, the agreed price, vendor bookings or the wedding's date.
dbDescribe('Couple-controlled functions (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let svc: typeof import('@/services/coupleFunctions.service').coupleFunctionsService;
  let asCouple: typeof import('@/lib/customer/coupleEntry').asCoupleWedding;
  const users: string[] = [];
  let couple = '';
  let stranger = '';
  let staffId = '';
  let weddingId = '';
  let quotationId = '';
  let otherBusinessId = '';

  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;
  const inDays = (n: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + n * 86_400_000));
  const snapshot = async () => {
    const w = await app.prisma.wedding.findUniqueOrThrow({ where: { id: weddingId }, select: { primaryDate: true, status: true } });
    const a = await app.prisma.commercialAgreement.findUniqueOrThrow({ where: { quotationId }, select: { agreementTotal: true } });
    const vb = await app.prisma.vendorBooking.findMany({ where: { weddingEvent: { weddingId } }, select: { id: true, status: true, agreedPrice: true }, orderBy: { id: 'asc' } });
    return JSON.stringify({ w, a, vb });
  };

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    svc = (await import('@/services/coupleFunctions.service')).coupleFunctionsService;
    asCouple = (await import('@/lib/customer/coupleEntry')).asCoupleWedding;
    for (const name of ['couple', 'stranger']) users.push((await app.prisma.user.create({ data: { name: `DBTEST ${name} ${fx.runId}`, phone: `97${String(Date.now()).slice(-7)}${users.length}` } })).id);
    [couple, stranger] = users;
    const staff = await app.prisma.user.findFirst({ where: { roles: { some: { role: { in: ['SUPER_ADMIN', 'SALES', 'OPERATIONS'] } } } }, select: { id: true } });
    staffId = staff!.id;

    const [{ id: vendorId }] = await fx.vendors(1);
    const c = await fx.consultation({ name: 'DBTEST couple functions', weddingDate: inDays(30), guestCount: 300 });
    const q = await fx.acceptedQuote(c.id, { items: [fx.line('Decoration package', 85500, 1, vendorId, 'Decorators')], advance: 5000 });
    quotationId = q.id;
    const booking = await app.quotationService.createBooking(q.id, {}, null);
    await app.commercialFlow.recordPaymentForQuotation(q.id, { amount: 21375, method: 'UPI' }, null);
    weddingId = (await app.prisma.wedding.findFirstOrThrow({ where: { sourceBookingId: booking.id } })).id;
    await app.prisma.wedding.update({ where: { id: weddingId }, data: { customerId: couple } });
    otherBusinessId = (await app.prisma.business.create({ data: { name: `DBTEST Venue ${fx.runId}`, kind: 'VENDOR', commercialStatus: 'SAAS' } })).id;
  });
  afterAll(async () => {
    if (fx) await fx.purge();
    if (app) {
      if (otherBusinessId) {
        await app.prisma.venueSpace.deleteMany({ where: { businessId: otherBusinessId } });
        await app.prisma.business.deleteMany({ where: { id: otherBusinessId } });
      }
      if (users.length) await app.prisma.user.deleteMany({ where: { id: { in: users } } });
    }
  });

  test('somewhere else: stands at once, is the couple’s own, and is in the wedding history with who did it', async () => {
    const before = await snapshot();
    const haldi = await asCouple(weddingId, couple, () =>
      svc.add(weddingId, { type: 'HALDI', date: inDays(25), startTime: '10:00', endTime: '13:00', place: 'ELSEWHERE', venueName: 'Home', venueAddress: 'Boring Road', description: 'Family only' }, couple)
    );
    expect(haldi).toMatchObject({ addedByCouple: true, confirmation: 'CONFIRMED', atBookedVenue: false, venueName: 'Home', endTime: '13:00', description: 'Family only' });
    const log = await app.prisma.activityLog.findFirst({ where: { weddingId, summary: { startsWith: 'The couple added Haldi' } } });
    expect(log?.performedById).toBe(couple);
    expect(await snapshot()).toBe(before); // booking, price, vendor bookings, wedding date: untouched
  });

  test('at the booked venue: WAITING — and still nothing about the booking changes', async () => {
    const before = await snapshot();
    const sangeet = await asCouple(weddingId, couple, () => svc.add(weddingId, { type: 'SANGEET', date: inDays(29), startTime: '19:00', endTime: '01:00', place: 'BOOKED_VENUE' }, couple));
    expect(sangeet).toMatchObject({ confirmation: 'WAITING', atBookedVenue: true, venueName: null });
    expect(await snapshot()).toBe(before);
  });

  test('the couple cannot add the Wedding itself, nor change or remove what staff set', async () => {
    expect((await errorOf(asCouple(weddingId, couple, () => svc.add(weddingId, { type: 'WEDDING', date: inDays(40), place: 'BOOKED_VENUE' }, couple))))?.message).toContain('set by your booking');
    const main = await app.prisma.weddingEvent.findFirstOrThrow({ where: { weddingId, type: 'WEDDING' } });
    expect((await errorOf(asCouple(weddingId, couple, () => svc.update(weddingId, main.id, { type: 'RECEPTION', date: inDays(40), place: 'ELSEWHERE', venueName: 'x' }, couple))))?.message).toContain('set by your planner');
    expect((await errorOf(asCouple(weddingId, couple, () => svc.remove(weddingId, main.id, couple))))?.message).toContain('set by your planner');
  });

  test('someone else’s wedding is simply not found', async () => {
    const err = await errorOf(asCouple(weddingId, stranger, () => svc.add(weddingId, { type: 'MEHNDI', date: inDays(20), place: 'ELSEWHERE', venueName: 'Home' }, stranger)));
    expect(err?.name).toBe('NotFoundError');
  });

  test('a hall from another business is refused', async () => {
    const space = await app.prisma.venueSpace.create({ data: { businessId: otherBusinessId, name: `DBTEST Hall ${fx.runId}` } });
    const err = await errorOf(asCouple(weddingId, couple, () => svc.add(weddingId, { type: 'RECEPTION', date: inDays(31), place: 'BOOKED_VENUE', venueSpaceId: space.id }, couple)));
    expect(err?.message).toContain('venue’s halls');
  });

  test('staff confirm only what they saw: a stale view is refused; a double click is harmless', async () => {
    const sangeet = await app.prisma.weddingEvent.findFirstOrThrow({ where: { weddingId, type: 'SANGEET' } });
    const stale = await errorOf(svc.decide(weddingId, sangeet.id, { decision: 'CONFIRM', seenUpdatedAt: new Date(sangeet.updatedAt.getTime() - 1000).toISOString() }, staffId));
    expect(stale?.name).toBe('ConflictError');
    const ok = await svc.decide(weddingId, sangeet.id, { decision: 'CONFIRM', seenUpdatedAt: sangeet.updatedAt.toISOString() }, staffId);
    expect(ok).toMatchObject({ confirmation: 'CONFIRMED', confirmedById: staffId });
    const again = await svc.decide(weddingId, sangeet.id, { decision: 'CONFIRM', seenUpdatedAt: ok.updatedAt.toISOString() }, staffId);
    expect(again.confirmation).toBe('CONFIRMED');
  });

  test('the couple changes a confirmed venue function: it goes back to WAITING; staff then say it is not possible (reason required)', async () => {
    const sangeet = await app.prisma.weddingEvent.findFirstOrThrow({ where: { weddingId, type: 'SANGEET' } });
    const moved = await asCouple(weddingId, couple, () => svc.update(weddingId, sangeet.id, { type: 'SANGEET', date: inDays(28), startTime: '20:00', place: 'BOOKED_VENUE' }, couple));
    expect(moved).toMatchObject({ confirmation: 'WAITING', confirmedById: null, startTime: '20:00' });
    expect((await errorOf(svc.decide(weddingId, sangeet.id, { decision: 'NOT_POSSIBLE', seenUpdatedAt: moved.updatedAt.toISOString() }, staffId)))?.message).toContain('why');
    const no = await svc.decide(weddingId, sangeet.id, { decision: 'NOT_POSSIBLE', note: 'The hall is taken that evening', seenUpdatedAt: moved.updatedAt.toISOString() }, staffId);
    expect(no).toMatchObject({ confirmation: 'NOT_POSSIBLE', confirmationNote: 'The hall is taken that evening' });
    // moving it somewhere else no longer touches the venue: it stands, and the old reason is gone
    const elsewhere = await asCouple(weddingId, couple, () => svc.update(weddingId, sangeet.id, { type: 'SANGEET', date: inDays(28), startTime: '20:00', place: 'ELSEWHERE', venueName: 'Community hall' }, couple));
    expect(elsewhere).toMatchObject({ confirmation: 'CONFIRMED', confirmationNote: null, atBookedVenue: false, venueName: 'Community hall' });
  });

  test('the couple’s view: functions with their status, and the staff workspace sees the same', async () => {
    const [event] = await app.clientPortalService.getEventsForClient(couple);
    const mine = event.functions.filter((f) => f.addedByCouple).map((f) => [f.type, f.confirmation, f.place]);
    expect(mine).toEqual(expect.arrayContaining([['HALDI', 'CONFIRMED', 'ELSEWHERE'], ['SANGEET', 'CONFIRMED', 'ELSEWHERE']]));
    expect(event.functions.find((f) => f.type === 'WEDDING')?.addedByCouple).toBe(false);
    const ws = await app.weddingWorkspaceService.getWorkspace(weddingId);
    expect(ws.events.filter((e) => e.addedByCouple).length).toBe(2);
  });

  test('removing: allowed for an untouched own function, blocked once guests have replied to it', async () => {
    const mehndi = await asCouple(weddingId, couple, () => svc.add(weddingId, { type: 'MEHNDI', date: inDays(27), place: 'ELSEWHERE', venueName: 'Home' }, couple));
    expect(await asCouple(weddingId, couple, () => svc.remove(weddingId, mehndi.id, couple))).toEqual({ removed: true });
    const haldi = await app.prisma.weddingEvent.findFirstOrThrow({ where: { weddingId, type: 'HALDI' } });
    const guest = await app.prisma.guest.create({ data: { weddingId, name: 'DBTEST guest' } });
    await app.prisma.guestFunctionResponse.create({ data: { guestId: guest.id, weddingEventId: haldi.id, status: 'ATTENDING' } });
    expect((await errorOf(asCouple(weddingId, couple, () => svc.remove(weddingId, haldi.id, couple))))?.message).toContain('Guests have already replied');
    expect(await app.prisma.weddingEvent.count({ where: { id: haldi.id } })).toBe(1);
  });

  test('a completed wedding cannot be changed', async () => {
    await app.prisma.wedding.update({ where: { id: weddingId }, data: { status: 'COMPLETED' } });
    const err = await errorOf(asCouple(weddingId, couple, () => svc.add(weddingId, { type: 'RECEPTION', date: inDays(35), place: 'ELSEWHERE', venueName: 'x' }, couple)));
    expect(err?.message).toContain('completed');
  });
});
