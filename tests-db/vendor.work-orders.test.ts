/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Pricing models and vendor work orders (money design v1, PR 4, 25 Nov 2026) on a real database: the founder sets fixed or commission;
// the vendor's yes issues a numbered, frozen work order in the same transaction; the database refuses changes to it and to the
// assignment's price while it is issued; a vendor never receives the client price, commission or margin; cancelling the assignment
// cancels the work order, kept with the reason.
dbDescribe('Vendor work orders (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let ws: typeof import('@/services/weddingWorkspace.service').weddingWorkspaceService;
  let wo: typeof import('@/services/vendorWorkOrder.service').vendorWorkOrderService;
  let vp: typeof import('@/services/vendorPayment.service').vendorPaymentService;
  let weddingId = '';
  let fixedId = '';
  let commissionId = '';
  let vendorId = '';
  let ownRateId: string | null = null;
  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    ws = (await import('@/services/weddingWorkspace.service')).weddingWorkspaceService;
    wo = (await import('@/services/vendorWorkOrder.service')).vendorWorkOrderService;
    vp = (await import('@/services/vendorPayment.service')).vendorPaymentService;
    const [vendor] = await fx.vendors(1);
    vendorId = vendor.id;
    const v = await app.prisma.vendor.findUniqueOrThrow({ where: { id: vendorId }, select: { categoryId: true } });
    ownRateId = (await app.prisma.commissionRate.create({ data: { categoryId: v.categoryId, rate: 10, effectiveFrom: new Date(Date.now() - 1000) } })).id;
    const c = await fx.consultation({ name: 'DBTEST work orders', weddingDate: '2027-04-10', guestCount: 250 });
    const q = await fx.acceptedQuote(c.id, { items: [fx.line('Stage decoration', 50000, 1, vendorId), fx.line('Entry arch', 50000, 1, vendorId)], advance: 25000 });
    const booking = await app.quotationService.createBooking(q.id, {}, null);
    const money = await app.agreement.loadAgreementMoney(q.id);
    await app.commercialFlow.recordPaymentForQuotation(q.id, { amount: money.confirmationAmount, method: 'UPI' }, null);
    weddingId = (await app.prisma.wedding.findFirstOrThrow({ where: { sourceBookingId: booking.id } })).id;
    const vbs = await app.prisma.vendorBooking.findMany({ where: { weddingEvent: { weddingId } }, orderBy: { createdAt: 'asc' } });
    [fixedId, commissionId] = vbs.map((b) => b.id);
  });
  afterAll(async () => {
    if (fx) await fx.purge();
    if (app && ownRateId) await app.prisma.commissionRate.delete({ where: { id: ownRateId } });
  });

  test('the founder sets a fixed vendor price; above the couple’s price it needs a confirmation and a reason', async () => {
    expect((await errorOf(wo.setPricing(weddingId, fixedId, { model: 'FIXED', vendorPrice: 60000 }, null)))?.message).toContain('above what the couple pays');
    await wo.setPricing(weddingId, fixedId, { model: 'FIXED', vendorPrice: 40000 }, null);
    expect(await app.prisma.vendorBooking.findUniqueOrThrow({ where: { id: fixedId }, select: { pricingModel: true, vendorPrice: true } })).toEqual({ pricingModel: 'FIXED', vendorPrice: 40000 });
    // the database never lets the two models mix
    expect(await errorOf(app.prisma.vendorBooking.update({ where: { id: commissionId }, data: { vendorPrice: 1000 } }))).not.toBeNull();
  });

  test('the vendor’s yes issues a numbered, frozen work order in the same step', async () => {
    await ws.updateVendorBookingStatus(weddingId, fixedId, 'CONFIRMED');
    const w = await app.prisma.vendorWorkOrder.findUniqueOrThrow({ where: { vendorBookingId: fixedId } });
    expect(w.number).toMatch(/^WO-\d{6}-\d{4}$/);
    expect(w).toMatchObject({ status: 'ISSUED', pricingModel: 'FIXED', vendorPayable: 40000, clientPrice: 50000, commissionRate: null, commissionAmount: null, margin: 10000, historical: false });
    expect((w.scope as { service: string; functionName: string }).functionName).toBeTruthy();
    await ws.updateVendorBookingStatus(weddingId, commissionId, 'CONFIRMED');
    const c = await app.prisma.vendorWorkOrder.findUniqueOrThrow({ where: { vendorBookingId: commissionId } });
    expect(c).toMatchObject({ pricingModel: 'COMMISSION', commissionRate: 10, commissionAmount: 5000, vendorPayable: 45000, margin: 5000 });
    expect(c.number).not.toBe(w.number);
    expect(await app.prisma.financeEvent.count({ where: { tableName: 'vendor_work_orders', rowId: w.id, action: 'INSERT' } })).toBe(1);
  });

  test('frozen: the database refuses to change an issued work order or the work’s price', async () => {
    const w = await app.prisma.vendorWorkOrder.findUniqueOrThrow({ where: { vendorBookingId: fixedId } });
    expect((await errorOf(app.prisma.vendorWorkOrder.update({ where: { id: w.id }, data: { vendorPayable: 1 } })))?.message).toContain('cannot be changed');
    expect((await errorOf(app.prisma.vendorBooking.update({ where: { id: fixedId }, data: { agreedPrice: 49000 } })))?.message).toContain('price is locked');
    expect((await errorOf(ws.updateVendorBookingPrice(weddingId, fixedId, 49000, null)))?.message).toContain('locked');
    expect((await errorOf(wo.setPricing(weddingId, fixedId, { model: 'COMMISSION' }, null)))?.message).toContain('locked');
  });

  test('the money follows the work order; a vendor is sent only their amount', async () => {
    const team = await vp.forWedding(weddingId, { seesCommission: true });
    expect(team.totals).toMatchObject({ workValue: 100000, net: 85000, commission: 5000, margin: 15000 });
    const mine = await vp.forVendor(vendorId);
    const fixed = mine.works.find((x) => x.id === fixedId)!;
    expect(fixed).toMatchObject({ payable: 40000, workOrder: { number: expect.stringMatching(/^WO-/) } });
    const sent = JSON.stringify([mine.works.filter((x) => x.id === fixedId || x.id === commissionId), await wo.forVendor(vendorId, fixed.workOrder!.id)]);
    for (const secret of ['50000', 'clientPrice', 'commission', 'margin']) expect(sent).not.toContain(secret);
    const coordinator = await vp.forWedding(weddingId, { seesCommission: false });
    expect(coordinator.totals).toMatchObject({ commission: null, margin: null, net: 85000 });
  });

  test('cancelling the work cancels its work order — kept, with the reason; a cancelled one never comes back', async () => {
    await ws.cancelVendorBooking(weddingId, commissionId, 'DBTEST vendor fell ill', null);
    const c = await app.prisma.vendorWorkOrder.findUniqueOrThrow({ where: { vendorBookingId: commissionId } });
    expect(c).toMatchObject({ status: 'CANCELLED', cancelReason: 'DBTEST vendor fell ill' });
    expect(c.cancelledAt).not.toBeNull();
    expect((await errorOf(app.prisma.vendorWorkOrder.update({ where: { id: c.id }, data: { status: 'ISSUED', cancelledAt: null, cancelReason: null } })))?.message).toBeTruthy();
  });
});
