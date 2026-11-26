/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';
import { quotedPriceFromTask } from '@/lib/booking/unassigned';

// PR A (26 Nov 2026) on a real database: every quotation line names its function and day, so the wedding gets one function per
// function + day and each service sits under its own, keeping its words, category, day, quoted price and discount share. Staff can
// move a service or change its day, category and words — but not the function or day once its work order is issued. A quotation
// whose lines name nothing still becomes the one "Wedding" function, as before.
dbDescribe('Quotation lines build the wedding functions (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let ws: typeof import('@/services/weddingWorkspace.service').weddingWorkspaceService;
  let wo: typeof import('@/services/vendorWorkOrder.service').vendorWorkOrderService;
  let ownRateId: string | null = null;
  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;
  type Line = ReturnType<Fixtures['line']>;
  const at = (l: Line, functionLabel: string, eventDate: string) => ({ ...l, functionLabel, eventDate }) as Line;

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    ws = (await import('@/services/weddingWorkspace.service')).weddingWorkspaceService;
    wo = (await import('@/services/vendorWorkOrder.service')).vendorWorkOrderService;
  });
  afterAll(async () => {
    if (app && ownRateId) await app.prisma.commissionRate.delete({ where: { id: ownRateId } });
    if (fx) await fx.purge();
  });

  async function weddingFrom(items: Line[], discount: number, weddingDate = '2027-02-10') {
    const c = await fx.consultation({ name: 'DBTEST lines-functions', weddingDate, guestCount: 300 });
    const q = await fx.acceptedQuote(c.id, { items, discount, advance: 10000 });
    const booking = await app.quotationService.createBooking(q.id, {}, null);
    const money = await app.agreement.loadAgreementMoney(q.id);
    await app.commercialFlow.recordPaymentForQuotation(q.id, { amount: money.confirmationAmount, method: 'UPI' }, null);
    return app.prisma.wedding.findFirstOrThrow({ where: { sourceBookingId: booking.id } });
  }
  const functionsOf = (weddingId: string) =>
    app.prisma.weddingEvent.findMany({ where: { weddingId }, orderBy: { date: 'asc' }, include: { vendorBookings: { orderBy: { createdAt: 'asc' } }, tasks: true } });

  test('one function per function + day; services keep their words, category, day, quoted price and discount', async () => {
    const [vendor] = await fx.vendors(1);
    const w = await weddingFrom(
      [
        at(fx.line('Rooms for 9 Feb', 2700, 5, vendor.id, 'Accommodation'), 'Accommodation', '2027-02-09'),
        at(fx.line('Food (B + L + D) for 9 Feb', 1150, 60, vendor.id, 'Food'), 'Accommodation', '2027-02-09'),
        at(fx.line('Main hall', 30000, 1, vendor.id, 'Hall'), 'Wedding', '2027-02-10'),
        at(fx.line('Haldi stage', 15000, 1, undefined, 'Decoration'), 'Haldi', '2027-02-08'),
      ],
      500
    );
    const fns = await functionsOf(w.id);
    expect(fns.map((f) => [f.type, f.label, f.date.toISOString().slice(0, 10)])).toEqual([
      ['HALDI', null, '2027-02-08'],
      ['OTHER', 'Accommodation', '2027-02-09'],
      ['WEDDING', null, '2027-02-10'],
    ]);
    const [haldi, acc, wedding] = fns;
    expect(acc.vendorBookings.map((b) => [b.description, b.serviceCategory, b.serviceDate?.toISOString().slice(0, 10), b.quotedPrice])).toEqual([
      ['Rooms for 9 Feb', 'Accommodation', '2027-02-09', 13500],
      ['Food (B + L + D) for 9 Feb', 'Food', '2027-02-09', 69000],
    ]);
    expect(wedding.vendorBookings.map((b) => b.description)).toEqual(['Main hall']);
    for (const b of [...acc.vendorBookings, ...wedding.vendorBookings]) expect(b.agreedPrice).toBe((b.quotedPrice ?? 0) - (b.discountShare ?? 0));
    // the vendorless line waits under its own function, and every rupee of the agreed amount is placed
    const assign = haldi.tasks.find((t) => t.title.startsWith('Assign a vendor for'));
    expect(assign).toBeDefined();
    const placed = [...acc.vendorBookings, ...wedding.vendorBookings].reduce((s, b) => s + b.agreedPrice, 0) + (quotedPriceFromTask(assign!.description) ?? 0);
    expect(placed).toBe(13500 + 69000 + 30000 + 15000 - 500);
    // the "confirm the vendor" tasks sit under the service's own function
    expect(acc.tasks.filter((t) => t.title.startsWith('Confirm booking with')).length).toBe(2);
  });

  test('a quotation whose lines name no function or day still becomes the one Wedding function — as before', async () => {
    const [vendor] = await fx.vendors(1);
    const w = await weddingFrom([fx.line('Decoration', 40000, 1, vendor.id), fx.line('Lights', 10000, 1, vendor.id)], 0);
    const fns = await functionsOf(w.id);
    expect(fns.map((f) => [f.type, f.label])).toEqual([['WEDDING', null]]);
    expect(fns[0].vendorBookings.length).toBe(2);
  });

  test('staff move a service and change its day, category and words; the timeline says so; never another wedding’s function', async () => {
    const [vendor] = await fx.vendors(1);
    const w = await weddingFrom(
      [
        at(fx.line('Snacks', 200, 150, vendor.id, 'Food'), 'Wedding', '2027-02-10'),
        at(fx.line('Rooms', 2300, 16, vendor.id, 'Accommodation'), 'Accommodation', '2027-02-11'),
      ],
      0
    );
    const [wedding, acc] = await functionsOf(w.id);
    const snacks = wedding.vendorBookings[0];
    await ws.updateVendorBookingDetails(w.id, snacks.id, { weddingEventId: acc.id, serviceDate: '2027-02-11', serviceCategory: 'Snacks', description: 'Evening snacks' }, null);
    const moved = await app.prisma.vendorBooking.findUniqueOrThrow({ where: { id: snacks.id } });
    expect([moved.weddingEventId, moved.serviceDate?.toISOString().slice(0, 10), moved.serviceCategory, moved.description, moved.agreedPrice]).toEqual([acc.id, '2027-02-11', 'Snacks', 'Evening snacks', 30000]);
    expect((await app.prisma.task.findFirstOrThrow({ where: { vendorBookingId: snacks.id } })).weddingEventId).toBe(acc.id);
    const log = await app.prisma.activityLog.findFirst({ where: { vendorBookingId: snacks.id, summary: { contains: 'moved to Accommodation' } } });
    expect(log?.summary).toContain('date 2027-02-10 → 2027-02-11');

    const other = await weddingFrom([at(fx.line('Hall', 20000, 1, vendor.id), 'Wedding', '2027-03-01')], 0, '2027-03-01');
    const [otherFn] = await functionsOf(other.id);
    expect((await errorOf(ws.updateVendorBookingDetails(w.id, snacks.id, { weddingEventId: otherFn.id, serviceDate: null, serviceCategory: null, description: null }, null)))?.message).toContain("this wedding's functions");
    expect((await errorOf(ws.updateVendorBookingDetails(w.id, snacks.id, { weddingEventId: acc.id, serviceDate: '2027-02-31', serviceCategory: null, description: null }, null)))?.message).toContain('does not look right');
  });

  test('once the work order is issued, its function and day stay; category and words can still change; the work order names the line', async () => {
    const [vendor] = await fx.vendors(1);
    const v = await app.prisma.vendor.findUniqueOrThrow({ where: { id: vendor.id }, select: { categoryId: true } });
    ownRateId = (await app.prisma.commissionRate.create({ data: { categoryId: v.categoryId, rate: 10, effectiveFrom: new Date(Date.now() - 1000) } })).id;
    const w = await weddingFrom(
      [at(fx.line('Food (B + L) for 11 Feb', 475, 120, vendor.id, 'Food'), 'Wedding', '2027-02-11'), at(fx.line('Haldi stage', 15000, 1, vendor.id, 'Decoration'), 'Haldi', '2027-02-09')],
      0
    );
    const [haldi, wedding] = await functionsOf(w.id);
    const food = wedding.vendorBookings[0];
    await wo.setPricing(w.id, food.id, { model: 'COMMISSION' }, null);
    await ws.updateVendorBookingStatus(w.id, food.id, 'CONFIRMED');
    const order = await app.prisma.vendorWorkOrder.findUniqueOrThrow({ where: { vendorBookingId: food.id } });
    expect(order.scope).toMatchObject({ functionDate: '2027-02-11', service: 'Food', packageName: 'Food (B + L) for 11 Feb' });

    const refused = await errorOf(ws.updateVendorBookingDetails(w.id, food.id, { weddingEventId: haldi.id, serviceDate: '2027-02-11', serviceCategory: 'Food', description: 'Food (B + L) for 11 Feb' }, null));
    expect(refused?.message).toContain(`Work order ${order.number} is issued`);
    await ws.updateVendorBookingDetails(w.id, food.id, { weddingEventId: wedding.id, serviceDate: '2027-02-11', serviceCategory: 'Catering', description: 'Lunch for 120' }, null);
    expect(await app.prisma.vendorBooking.findUniqueOrThrow({ where: { id: food.id }, select: { serviceCategory: true, description: true, weddingEventId: true } })).toEqual({ serviceCategory: 'Catering', description: 'Lunch for 120', weddingEventId: wedding.id });
  });
});
