/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Historical work orders (money design v1, PR 5, 25 Nov 2026) on a real database: the preview reads and writes nothing; only ticked rows
// are issued, marked historical, at exactly the previewed amount; a changed amount or an existing work order refuses the whole batch.
dbDescribe('Historical work orders (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let svc: typeof import('@/services/vendorWorkOrder.service').vendorWorkOrderService;
  let a = '';
  let b = '';
  let ownRateId: string | null = null;
  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    svc = (await import('@/services/vendorWorkOrder.service')).vendorWorkOrderService;
    const [vendor] = await fx.vendors(1);
    const v = await app.prisma.vendor.findUniqueOrThrow({ where: { id: vendor.id }, select: { categoryId: true } });
    ownRateId = (await app.prisma.commissionRate.create({ data: { categoryId: v.categoryId, rate: 10, effectiveFrom: new Date(Date.now() - 1000) } })).id;
    const c = await fx.consultation({ name: 'DBTEST historical WO', weddingDate: '2027-05-01', guestCount: 150 });
    const q = await fx.acceptedQuote(c.id, { items: [fx.line('Lighting', 30000, 1, vendor.id), fx.line('Sound', 20000, 1, vendor.id)], advance: 12500 });
    const booking = await app.quotationService.createBooking(q.id, {}, null);
    const money = await app.agreement.loadAgreementMoney(q.id);
    await app.commercialFlow.recordPaymentForQuotation(q.id, { amount: money.confirmationAmount, method: 'UPI' }, null);
    const weddingId = (await app.prisma.wedding.findFirstOrThrow({ where: { sourceBookingId: booking.id } })).id;
    [a, b] = (await app.prisma.vendorBooking.findMany({ where: { weddingEvent: { weddingId } }, orderBy: { createdAt: 'asc' } })).map((x) => x.id);
    // confirmed BEFORE work orders existed: set the status directly, as the older rows were
    await app.prisma.vendorBooking.updateMany({ where: { id: { in: [a, b] } }, data: { status: 'CONFIRMED' } });
  });
  afterAll(async () => {
    if (fx) await fx.purge();
    if (app && ownRateId) await app.prisma.commissionRate.delete({ where: { id: ownRateId } });
  });

  test('the preview lists them with the asked-for figures and writes nothing', async () => {
    const before = await app.prisma.financeEvent.count();
    const rows = (await svc.historicalPreview()).filter((r) => r.vendorBookingId === a || r.vendorBookingId === b);
    expect(rows.map((r) => [r.agreedValue, r.pricingModel, r.modelIsDefault, r.commissionRate, r.proposedPayable, r.paid, r.remaining, r.canIssue])).toEqual([
      [30000, 'COMMISSION', true, 10, 27000, 0, 27000, true],
      [20000, 'COMMISSION', true, 10, 18000, 0, 18000, true],
    ]);
    expect(await app.prisma.financeEvent.count()).toBe(before);
    expect(await app.prisma.vendorWorkOrder.count({ where: { vendorBookingId: { in: [a, b] } } })).toBe(0);
  });

  test('a changed amount refuses the whole batch — nothing is issued', async () => {
    expect((await errorOf(svc.issueHistorical([{ vendorBookingId: a, expectedPayable: 27000 }, { vendorBookingId: b, expectedPayable: 17999 }], null)))?.message).toContain('changed since the preview');
    expect(await app.prisma.vendorWorkOrder.count({ where: { vendorBookingId: { in: [a, b] } } })).toBe(0);
  });

  test('only the ticked row is issued, marked historical, at the previewed amount; a second issue is refused', async () => {
    const issued = await svc.issueHistorical([{ vendorBookingId: a, expectedPayable: 27000 }], null);
    expect(issued).toHaveLength(1);
    const wo = await app.prisma.vendorWorkOrder.findUniqueOrThrow({ where: { vendorBookingId: a } });
    expect(wo).toMatchObject({ historical: true, vendorPayable: 27000, clientPrice: 30000, commissionRate: 10, status: 'ISSUED' });
    expect(await app.prisma.vendorWorkOrder.count({ where: { vendorBookingId: b } })).toBe(0);
    expect((await errorOf(svc.issueHistorical([{ vendorBookingId: a, expectedPayable: 27000 }], null)))?.message).toContain('already exists');
    expect((await svc.historicalPreview()).some((r) => r.vendorBookingId === a)).toBe(false);
  });
});
