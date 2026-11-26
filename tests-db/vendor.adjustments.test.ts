/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Adjustments, completion and the final-payment hold (money design v1, PR 6, 25 Nov 2026) on a real database.
dbDescribe('Work order adjustments, work done, final payment hold (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let ws: typeof import('@/services/weddingWorkspace.service').weddingWorkspaceService;
  let wo: typeof import('@/services/vendorWorkOrder.service').vendorWorkOrderService;
  let vp: typeof import('@/services/vendorPayment.service').vendorPaymentService;
  let portal: typeof import('@/services/venuePortal.service').venuePortalService;
  let weddingId = '';
  let vbId = '';
  let vendorId = '';
  let ownerId = '';
  let ownRateId: string | null = null;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;
  const mine = async () => (await vp.forVendor(vendorId)).works.find((w) => w.id === vbId)!;

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    ws = (await import('@/services/weddingWorkspace.service')).weddingWorkspaceService;
    wo = (await import('@/services/vendorWorkOrder.service')).vendorWorkOrderService;
    vp = (await import('@/services/vendorPayment.service')).vendorPaymentService;
    portal = (await import('@/services/venuePortal.service')).venuePortalService;
    const [vendor] = await fx.vendors(1);
    vendorId = vendor.id;
    ownerId = (await app.prisma.user.findFirstOrThrow({ select: { id: true }, orderBy: { createdAt: 'asc' } })).id;
    const v = await app.prisma.vendor.findUniqueOrThrow({ where: { id: vendorId }, select: { categoryId: true } });
    ownRateId = (await app.prisma.commissionRate.create({ data: { categoryId: v.categoryId, rate: 10, effectiveFrom: new Date(Date.now() - 1000) } })).id;
    const c = await fx.consultation({ name: 'DBTEST adjustments', weddingDate: '2027-06-01', guestCount: 120 });
    const q = await fx.acceptedQuote(c.id, { items: [fx.line('Floral decor', 50000, 1, vendorId)], advance: 12500 });
    const booking = await app.quotationService.createBooking(q.id, {}, null);
    const money = await app.agreement.loadAgreementMoney(q.id);
    await app.commercialFlow.recordPaymentForQuotation(q.id, { amount: money.confirmationAmount, method: 'UPI' }, null);
    weddingId = (await app.prisma.wedding.findFirstOrThrow({ where: { sourceBookingId: booking.id } })).id;
    vbId = (await app.prisma.vendorBooking.findFirstOrThrow({ where: { weddingEvent: { weddingId } } })).id;
    await wo.setPricing(weddingId, vbId, { model: 'FIXED', vendorPrice: 40000 }, null);
    await ws.updateVendorBookingStatus(weddingId, vbId, 'CONFIRMED');
  });
  afterAll(async () => {
    if (app && vbId) await app.prisma.vendorPayment.deleteMany({ where: { vendorBookingId: vbId } });
    if (fx) await fx.purge();
    if (app && ownRateId) await app.prisma.commissionRate.delete({ where: { id: ownRateId } });
  });

  test('extra work raises the vendor’s amount by an adjustment; the work order itself never changes; the vendor sees it', async () => {
    await wo.addAdjustment(weddingId, vbId, { kind: 'EXTRA_WORK', amount: 5000, clientPriceDelta: 6000, reason: 'DBTEST second entry arch' }, null);
    const issued = await app.prisma.vendorWorkOrder.findUniqueOrThrow({ where: { vendorBookingId: vbId }, include: { adjustments: true } });
    expect(issued.vendorPayable).toBe(40000);
    expect(issued.adjustments).toHaveLength(1);
    expect(await mine()).toMatchObject({ payable: 45000, adjustments: [{ payableDelta: 5000, reason: 'DBTEST second entry arch' }] });
    const view = await wo.forVendor(vendorId, issued.id);
    expect(view).toMatchObject({ vendorPayable: 40000, payableNow: 45000 });
    expect(JSON.stringify([await mine(), view])).not.toContain('6000'); // the couple's side of the change is internal
    const team = await vp.forWedding(weddingId, { seesCommission: true });
    expect(team.totals).toMatchObject({ net: 45000, workValue: 56000, margin: 11000 });
    expect((await errorOf(app.prisma.workOrderAdjustment.update({ where: { id: issued.adjustments[0].id }, data: { payableDelta: 1 } })))?.message).toContain('cannot be changed');
  });

  test('never below what was already paid — the app refuses, and so does the database', async () => {
    await vp.record(weddingId, vbId, { amount: 30000, paidOn: today, method: 'UPI' }, null);
    expect((await errorOf(wo.addAdjustment(weddingId, vbId, { kind: 'CANCELLATION', amount: 20000, reason: 'DBTEST gate dropped' }, null)))?.message).toContain('below the ₹30,000 already paid');
    const w = await app.prisma.vendorWorkOrder.findUniqueOrThrow({ where: { vendorBookingId: vbId } });
    expect((await errorOf(app.prisma.workOrderAdjustment.create({ data: { workOrderId: w.id, kind: 'CANCELLATION', payableDelta: -20000, reason: 'DBTEST direct' } })))?.message).toContain('below what was already paid');
  });

  test('the final payment waits for the check — or is recorded with a reason', async () => {
    expect((await errorOf(vp.record(weddingId, vbId, { amount: 15000, paidOn: today, method: 'UPI' }, null)))?.message).toContain('final payment');
    await vp.record(weddingId, vbId, { amount: 5000, paidOn: today, method: 'UPI' }, null); // a part payment is fine
    const final = await vp.record(weddingId, vbId, { amount: 10000, paidOn: today, method: 'UPI', finalOverrideReason: 'DBTEST vendor needs it before the wedding' }, ownerId);
    expect(final).toMatchObject({ finalOverrideReason: 'DBTEST vendor needs it before the wedding', finalOverrideById: ownerId });
    expect(await mine()).toMatchObject({ remaining: 0 });
  });

  test('the vendor says done; staff verify it; then nothing waits', async () => {
    const before = await mine();
    expect(before.workStatus).not.toBe('AWAITING_CHECK');
    await portal.markDone({ vendorId, userId: ownerId }, vbId, 'DBTEST all set up');
    expect((await mine()).workStatus).toBe('AWAITING_CHECK');
    await ws.updateVendorBookingStatus(weddingId, vbId, 'COMPLETED', undefined, true, { actorId: ownerId });
    const b = await app.prisma.vendorBooking.findUniqueOrThrow({ where: { id: vbId }, select: { status: true, verifiedAt: true, verifiedById: true, vendorDoneNote: true } });
    expect(b).toMatchObject({ status: 'COMPLETED', verifiedById: ownerId, vendorDoneNote: 'DBTEST all set up' });
    expect(b.verifiedAt).not.toBeNull();
    expect((await mine()).workStatus).toBe('COMPLETED');
  });
});
