/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';
import { buildControlRoom } from '@/lib/wedding/controlRoom';
import type { WeddingWorkspace } from '@/components/wedding/workspace/types';

// Functions & Services, through the real services against staging: add / edit / delete a function (and the wedding's date following the
// Wedding function), and cancel / replace / re-price a vendor. Nothing here talks to the outside world.
dbDescribe('Functions & Services (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let weddingId = '';
  let otherWeddingId = '';
  let staffId = '';
  let vendorA = ''; // venue
  let vendorB = ''; // photography
  let vendorC = ''; // replacement
  let mainEventId = '';

  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;
  const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
  const workspace = async () => JSON.parse(JSON.stringify(await app.weddingWorkspaceService.getWorkspace(weddingId))) as WeddingWorkspace;
  const view = async () => buildControlRoom(await workspace());
  const wedding = () => app.prisma.wedding.findUniqueOrThrow({ where: { id: weddingId } });
  const bookingOn = async (vendorId: string) => app.prisma.vendorBooking.findFirstOrThrow({ where: { vendorId, weddingEvent: { weddingId } }, orderBy: { createdAt: 'desc' } });
  const tasksFor = (vendorBookingId: string) => app.prisma.task.findMany({ where: { vendorBookingId } });
  const logged = (startsWith: string) => app.prisma.activityLog.findFirst({ where: { weddingId, summary: { startsWith } } });

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    [{ id: vendorA }, { id: vendorB }, { id: vendorC }] = await fx.vendors(3);
    const staff = await app.prisma.user.findFirst({ where: { roles: { some: { role: { in: ['SUPER_ADMIN', 'SALES', 'OPERATIONS'] } } } }, select: { id: true } });
    if (!staff) throw new Error('the staging database needs at least one staff user');
    staffId = staff.id;
    const make = async (name: string) => {
      const consultation = await fx.consultation({ name, weddingDate: '2027-02-10', guestCount: 150 });
      const { booking } = await fx.confirmedBooking(consultation.id, { advance: 10000, items: [fx.line('Banquet hall hire', 40000, 1, vendorA, 'Venue'), fx.line('Photography', 15000, 1, vendorB, 'Photography')] });
      return (await app.convertBookingToWedding(booking.id)).id;
    };
    weddingId = await make('DBTEST Functions One');
    otherWeddingId = await make('DBTEST Functions Two');
    mainEventId = (await app.prisma.weddingEvent.findFirstOrThrow({ where: { weddingId } })).id;
  });
  afterAll(async () => {
    if (fx) await fx.purge();
  });

  test('a new wedding has one function; adding Mehndi and Sangeet works, the city follows the wedding, and it is logged', async () => {
    const mehndi = await app.weddingWorkspaceService.addFunction(weddingId, { type: 'MEHNDI', date: day('2027-02-08'), startTime: '16:00', venueName: 'Home', budget: 50000 }, staffId);
    expect(mehndi).toMatchObject({ type: 'MEHNDI', label: null, startTime: '16:00', venueName: 'Home', budget: 50000 });
    expect(mehndi.city).toBe((await wedding()).city);
    const other = await app.weddingWorkspaceService.addFunction(weddingId, { type: 'OTHER', label: 'Cocktail night', date: day('2027-02-09'), city: 'Patna' }, staffId);
    expect(other).toMatchObject({ type: 'OTHER', label: 'Cocktail night', city: 'Patna' });
    const ws = await workspace();
    expect(ws.events.map((e) => e.label ?? e.type)).toEqual(['MEHNDI', 'Cocktail night', 'WEDDING']); // ordered by date
    expect(await logged('Function added: Mehndi')).not.toBeNull();
    expect((await view()).functions.map((f) => f.name)).toEqual(['Mehndi', 'Cocktail night', 'Wedding']);
  });

  test('a function must make sense: an Other needs a name, the time must be HH:MM, the budget a whole number', async () => {
    expect((await errorOf(app.weddingWorkspaceService.addFunction(weddingId, { type: 'OTHER', date: day('2027-02-09') }, staffId)))?.message).toContain('name');
    expect((await errorOf(app.weddingWorkspaceService.addFunction(weddingId, { type: 'HALDI', date: day('2027-02-07'), startTime: '7pm' }, staffId)))?.message).toContain('18:30');
    expect((await errorOf(app.weddingWorkspaceService.addFunction(weddingId, { type: 'HALDI', date: day('2027-02-07'), budget: -5 }, staffId)))?.name).toBe('ValidationError');
    expect((await errorOf(app.weddingWorkspaceService.addFunction('00000000-0000-0000-0000-000000000000', { type: 'HALDI', date: day('2027-02-07') }, staffId)))?.name).toBe('NotFoundError');
  });

  test('editing: only what is sent changes; moving the Wedding function moves the wedding date, moving Mehndi does not', async () => {
    const mehndiId = (await app.prisma.weddingEvent.findFirstOrThrow({ where: { weddingId, type: 'MEHNDI' } })).id;
    const before = await wedding();
    const moved = await app.weddingWorkspaceService.updateFunction(weddingId, mehndiId, { date: day('2027-02-07'), venueName: 'Aunt’s house' }, staffId);
    expect(moved).toMatchObject({ venueName: 'Aunt’s house', startTime: '16:00', budget: 50000 }); // untouched fields kept
    expect((await wedding()).primaryDate).toEqual(before.primaryDate);

    await app.weddingWorkspaceService.updateFunction(weddingId, mainEventId, { date: day('2027-02-12') }, staffId);
    expect((await wedding()).primaryDate).toEqual(day('2027-02-12'));
    expect(await logged('Function updated: Wedding — date now 2027-02-12')).not.toBeNull();

    // clearing optional fields, and the name only sticks to an Other
    const cleared = await app.weddingWorkspaceService.updateFunction(weddingId, mehndiId, { startTime: null, budget: null }, staffId);
    expect(cleared).toMatchObject({ startTime: null, budget: null });
    const otherId = (await app.prisma.weddingEvent.findFirstOrThrow({ where: { weddingId, type: 'OTHER' } })).id;
    expect((await app.weddingWorkspaceService.updateFunction(weddingId, otherId, { type: 'HALDI' }, staffId)).label).toBeNull();
    expect((await errorOf(app.weddingWorkspaceService.updateFunction(weddingId, otherId, { type: 'OTHER' }, staffId)))?.message).toContain('name');
    expect((await errorOf(app.weddingWorkspaceService.updateFunction(weddingId, mainEventId, { city: '  ' }, staffId)))?.message).toContain('city');
    // a function of another wedding is not found
    const foreign = (await app.prisma.weddingEvent.findFirstOrThrow({ where: { weddingId: otherWeddingId } })).id;
    expect((await errorOf(app.weddingWorkspaceService.updateFunction(weddingId, foreign, { budget: 1 }, staffId)))?.name).toBe('NotFoundError');
  });

  test('deleting: an empty function goes; the last one, one with vendors booked, and one with a quoted service waiting stay', async () => {
    const emptyId = (await app.prisma.weddingEvent.findFirstOrThrow({ where: { weddingId, type: 'HALDI' } })).id; // the former "Cocktail night"
    await app.weddingWorkspaceService.deleteFunction(weddingId, emptyId, staffId);
    expect(await app.prisma.weddingEvent.findUnique({ where: { id: emptyId } })).toBeNull();
    expect(await logged('Function deleted: Haldi')).not.toBeNull();

    expect((await errorOf(app.weddingWorkspaceService.deleteFunction(weddingId, mainEventId, staffId)))?.message).toContain('vendors are booked'); // has the venue + photography

    // an event that has only a quoted-but-unassigned service
    const sangeet = await app.weddingWorkspaceService.addFunction(weddingId, { type: 'SANGEET', date: day('2027-02-09') }, staffId);
    await app.prisma.task.create({ data: { context: 'WEDDING_TASK', title: 'Assign a vendor for "DJ"', description: 'Quoted = ₹20,000. Choose the vendor.', weddingId, weddingEventId: sangeet.id } });
    expect((await errorOf(app.weddingWorkspaceService.deleteFunction(weddingId, sangeet.id, staffId)))?.message).toContain('quoted service');
    await app.prisma.task.deleteMany({ where: { weddingEventId: sangeet.id } });
    await app.weddingWorkspaceService.deleteFunction(weddingId, sangeet.id, staffId);

    // a function whose vendor was cancelled and whose service was removed is empty again — history does not block it
    const reception = await app.weddingWorkspaceService.addFunction(weddingId, { type: 'RECEPTION', date: day('2027-02-13') }, staffId);
    const booked = await app.weddingWorkspaceService.addVendorBooking(weddingId, { weddingEventId: reception.id, vendorId: vendorC, agreedPrice: 30000 }, staffId);
    expect((await errorOf(app.weddingWorkspaceService.deleteFunction(weddingId, reception.id, staffId)))?.message).toContain('vendor is booked');
    await app.weddingWorkspaceService.cancelVendorBooking(weddingId, booked.id, 'not needed', staffId);
    const waiting = await app.prisma.task.findFirstOrThrow({ where: { weddingEventId: reception.id, title: { startsWith: 'Assign a vendor for' }, status: 'PENDING' } });
    expect((await errorOf(app.weddingWorkspaceService.deleteFunction(weddingId, reception.id, staffId)))?.message).toContain('quoted service');
    await app.weddingWorkspaceService.updateTask(weddingId, waiting.id, { status: 'CANCELLED' }); // "Remove service" in the UI
    await app.weddingWorkspaceService.deleteFunction(weddingId, reception.id, staffId);
    expect(await app.prisma.weddingEvent.findUnique({ where: { id: reception.id } })).toBeNull();

    // the last remaining function of the other wedding
    const lone = (await app.prisma.weddingEvent.findFirstOrThrow({ where: { weddingId: otherWeddingId } })).id;
    expect((await errorOf(app.weddingWorkspaceService.deleteFunction(otherWeddingId, lone, staffId)))?.name).toBe('ValidationError');
    expect((await errorOf(app.weddingWorkspaceService.deleteFunction(weddingId, lone, staffId)))?.name).toBe('NotFoundError'); // wrong wedding
  });

  test('a finished or cancelled wedding does not take function changes', async () => {
    await app.prisma.wedding.update({ where: { id: otherWeddingId }, data: { status: 'CANCELLED' } });
    expect((await errorOf(app.weddingWorkspaceService.addFunction(otherWeddingId, { type: 'HALDI', date: day('2027-02-07') }, staffId)))?.message).toContain('cancelled');
    await app.prisma.wedding.update({ where: { id: otherWeddingId }, data: { status: 'PLANNING' } });
  });

  test('cancel a pending vendor: booking cancelled, its confirm task cancelled, and the service returns to "needs a vendor" with its price', async () => {
    const booking = await bookingOn(vendorB);
    expect(booking.status).toBe('PENDING_VENDOR_CONFIRMATION');
    await app.weddingWorkspaceService.cancelVendorBooking(weddingId, booking.id, 'changed our mind', staffId);

    expect((await app.prisma.vendorBooking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CANCELLED');
    expect((await tasksFor(booking.id)).every((t) => t.status === 'CANCELLED')).toBe(true);
    expect(await logged('Vendor cancelled:')).not.toBeNull();

    const v = await view();
    const row = v.vendors.find((r) => r.state === 'unassigned' && r.weddingEventId === mainEventId)!;
    expect(row).toBeTruthy();
    expect(row.quotedPrice).toBe(15000);
    expect(v.vendors.some((r) => r.vendorBookingId === booking.id)).toBe(false); // the cancelled booking is not listed
    expect(v.attention.map((a) => a.kind)).toContain('ASSIGN_VENDOR');

    // assigning the vendor again through the normal flow resolves that task
    await app.weddingWorkspaceService.addVendorBooking(weddingId, { weddingEventId: mainEventId, vendorId: vendorC, agreedPrice: 15000, resolvesTaskId: row.taskId as string }, staffId);
    expect((await view()).vendors.some((r) => r.state === 'unassigned')).toBe(false);
  });

  test('cancelling is refused once the work is done, for another wedding, and through the plain status call', async () => {
    const booking = await bookingOn(vendorA); // the venue, still pending
    expect((await errorOf(app.weddingWorkspaceService.cancelVendorBooking(otherWeddingId, booking.id, '', staffId)))?.name).toBe('NotFoundError');
    expect((await errorOf(app.weddingWorkspaceService.updateVendorBookingStatus(weddingId, booking.id, 'CANCELLED')))?.name).toBe('ValidationError');

    await app.weddingWorkspaceService.updateVendorBookingStatus(weddingId, booking.id, 'CONFIRMED');
    await app.weddingWorkspaceService.updateVendorBookingStatus(weddingId, booking.id, 'COMPLETED', undefined, true);
    expect((await errorOf(app.weddingWorkspaceService.cancelVendorBooking(weddingId, booking.id, '', staffId)))?.name).toBe('InvalidTransitionError');
    expect((await errorOf(app.weddingWorkspaceService.updateVendorBookingPrice(weddingId, booking.id, 1, staffId)))?.name).toBe('InvalidTransitionError');
  });

  test('replace a vendor: old one cancelled, new one pending on the same function, no leftover "assign" task; same vendor and bad price refused', async () => {
    const current = await bookingOn(vendorC); // photography, re-booked in the previous test
    expect((await errorOf(app.weddingWorkspaceService.replaceVendorBooking(weddingId, current.id, { vendorId: vendorC, agreedPrice: 16000 }, staffId)))?.message).toContain('same vendor');
    expect((await errorOf(app.weddingWorkspaceService.replaceVendorBooking(weddingId, current.id, { vendorId: vendorB, agreedPrice: 0 }, staffId)))?.name).toBe('ValidationError');
    const openAssignBefore = await app.prisma.task.count({ where: { weddingId, status: 'PENDING', title: { startsWith: 'Assign a vendor for' } } });

    const fresh = await app.weddingWorkspaceService.replaceVendorBooking(weddingId, current.id, { vendorId: vendorB, agreedPrice: 16500, reason: 'they asked for more' }, staffId);
    expect(fresh).toMatchObject({ vendorId: vendorB, agreedPrice: 16500, status: 'PENDING_VENDOR_CONFIRMATION', weddingEventId: mainEventId });
    expect((await app.prisma.vendorBooking.findUniqueOrThrow({ where: { id: current.id } })).status).toBe('CANCELLED');
    expect((await tasksFor(current.id)).every((t) => t.status === 'CANCELLED')).toBe(true);
    expect((await tasksFor(fresh.id)).map((t) => t.title)).toEqual([expect.stringContaining('Confirm booking with')]);
    expect(await app.prisma.task.count({ where: { weddingId, status: 'PENDING', title: { startsWith: 'Assign a vendor for' } } })).toBe(openAssignBefore);
    expect(await logged('Vendor booking added:')).not.toBeNull();
    const pending = (await view()).vendors.filter((r) => r.state === 'pending');
    expect(pending.map((r) => r.vendorBookingId)).toEqual([fresh.id]);
  });

  test('a declined vendor can be cancelled and replaced; the price of a pending or confirmed one can be corrected — and is logged', async () => {
    const pending = await bookingOn(vendorB);
    await app.weddingWorkspaceService.updateVendorBookingStatus(weddingId, pending.id, 'DECLINED', 'fully booked');
    expect((await errorOf(app.weddingWorkspaceService.updateVendorBookingPrice(weddingId, pending.id, 20000, staffId)))?.name).toBe('InvalidTransitionError');
    const replaced = await app.weddingWorkspaceService.replaceVendorBooking(weddingId, pending.id, { vendorId: vendorC, agreedPrice: 15000 }, staffId);
    expect((await app.prisma.vendorBooking.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe('CANCELLED');

    expect((await errorOf(app.weddingWorkspaceService.updateVendorBookingPrice(weddingId, replaced.id, 1.5, staffId)))?.name).toBe('ValidationError');
    const same = await app.weddingWorkspaceService.updateVendorBookingPrice(weddingId, replaced.id, 15000, staffId);
    expect(same.agreedPrice).toBe(15000);
    const changed = await app.weddingWorkspaceService.updateVendorBookingPrice(weddingId, replaced.id, 17500, staffId);
    expect(changed.agreedPrice).toBe(17500);
    expect(await logged('Agreed price for')).not.toBeNull();
    expect((await workspace()).events.flatMap((e) => e.vendorBookings).find((b) => b.id === replaced.id)?.agreedPrice).toBe(17500);
  });
});
