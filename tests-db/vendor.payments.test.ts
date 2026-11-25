/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Vendor money (25 Nov 2026) on a real database. Found on WED-2026-0002: the vendor's dashboard showed ₹0 for ₹28,000 of confirmed
// work, because only payouts were counted. Now confirmed work is owed, payments are recorded one by one, never above what is left,
// a wrong entry is voided (kept), and the older single payout can never be used on top of recorded payments.
dbDescribe('Vendor payments and money (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let svc: typeof import('@/services/vendorPayment.service').vendorPaymentService;
  let payouts: typeof import('@/services/payout.service').payoutService;
  let weddingId = '';
  let vbId = '';
  let vendorId = '';
  let ownRateId: string | null = null;
  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    svc = (await import('@/services/vendorPayment.service')).vendorPaymentService;
    payouts = (await import('@/services/payout.service')).payoutService;
    const [vendor] = await fx.vendors(1);
    vendorId = vendor.id;
    const v = await app.prisma.vendor.findUniqueOrThrow({ where: { id: vendorId }, select: { categoryId: true } });
    // This test needs a known rate: a category rate of its own (removed afterwards), effective a second ago.
    ownRateId = (await app.prisma.commissionRate.create({ data: { categoryId: v.categoryId, rate: 10, effectiveFrom: new Date(Date.now() - 1000) } })).id;
    const c = await fx.consultation({ name: 'DBTEST vendor money', weddingDate: '2027-02-10', guestCount: 300 });
    const q = await fx.acceptedQuote(c.id, { items: [fx.line('Decoration package', 100000, 1, vendorId)], advance: 25000 });
    const booking = await app.quotationService.createBooking(q.id, {}, null);
    const money = await app.agreement.loadAgreementMoney(q.id);
    await app.commercialFlow.recordPaymentForQuotation(q.id, { amount: money.confirmationAmount, method: 'UPI' }, null);
    weddingId = (await app.prisma.wedding.findFirstOrThrow({ where: { sourceBookingId: booking.id } })).id;
    const vb = await app.prisma.vendorBooking.findFirstOrThrow({ where: { weddingEvent: { weddingId }, vendorId } });
    vbId = vb.id;
  });
  afterAll(async () => {
    if (app && vbId) await app.prisma.vendorPayment.deleteMany({ where: { vendorBookingId: vbId } }); // test rows only (RESTRICT would block the purge)
    if (app && vbId) await app.prisma.payout.deleteMany({ where: { vendorBookingId: vbId } });
    if (fx) await fx.purge();
    if (app && ownRateId) await app.prisma.commissionRate.delete({ where: { id: ownRateId } });
  });

  test('waiting for the vendor: not owed yet, shown apart', async () => {
    const { totals } = await svc.forWedding(weddingId, { seesCommission: true });
    expect(totals).toMatchObject({ workValue: 0, awaitingVendorValue: 100000, works: 0 });
  });

  test('confirmed: owed ₹1,00,000, ₹90,000 to the vendor after 10% — not ₹0', async () => {
    await app.prisma.vendorBooking.update({ where: { id: vbId }, data: { status: 'CONFIRMED' } });
    const { vendors, totals } = await svc.forWedding(weddingId, { seesCommission: true });
    expect(totals).toMatchObject({ workValue: 100000, commission: 10000, net: 90000, paid: 0, remaining: 90000 });
    expect(vendors[0].works[0].money).toMatchObject({ workStatus: 'NOT_STARTED', commissionIsEstimate: true });
    const mine = await svc.forVendor(vendorId);
    expect(mine.works.find((w) => w.id === vbId)).toMatchObject({ payable: 90000, remaining: 90000 }); // the vendor sees the same numbers
    expect(JSON.stringify(mine)).not.toMatch(/100000|commission|agreedPrice|workValue/); // never the couple's price or our commission (25 Nov 2026)
    const hidden = await svc.forWedding(weddingId, { seesCommission: false });
    expect(hidden.totals.commission).toBeNull();
    expect(hidden.vendors[0].works[0].money.commission).toBeNull();
  });

  test('payments one by one, never above what is left; a wrong entry is voided and kept', async () => {
    const first = await svc.record(weddingId, vbId, { amount: '30,000', paidOn: today, method: 'UPI', reference: 'UTR1' }, null);
    expect(first.amount).toBe(30000);
    expect((await errorOf(svc.record(weddingId, vbId, { amount: 60001, paidOn: today, method: 'UPI' }, null)))?.message).toContain('more than is left');
    const wrong = await svc.record(weddingId, vbId, { amount: 50000, paidOn: today, method: 'CASH' }, null);
    expect((await svc.forWedding(weddingId, { seesCommission: true })).totals).toMatchObject({ paid: 80000, remaining: 10000 });
    await svc.voidPayment(weddingId, wrong.id, 'Typed 50,000 instead of 5,000', null);
    expect((await errorOf(svc.voidPayment(weddingId, wrong.id, 'again', null)))?.message).toContain('already voided');
    const after = await svc.forWedding(weddingId, { seesCommission: true });
    expect(after.totals).toMatchObject({ paid: 30000, remaining: 60000 });
    const entries = after.vendors[0].works[0].payments;
    expect(entries.map((p) => [p.amount, p.voided])).toEqual([[30000, false], [50000, true]]); // nothing deleted
    expect(await app.prisma.activityLog.count({ where: { weddingId, OR: [{ summary: { startsWith: 'Paid ' } }, { summary: { startsWith: 'Payment entry voided' } }] } })).toBe(3);
  });

  test('two people recording at the same moment can never together pay more than is left', async () => {
    const results = await Promise.allSettled([
      svc.record(weddingId, vbId, { amount: 40000, paidOn: today, method: 'UPI' }, null),
      svc.record(weddingId, vbId, { amount: 40000, paidOn: today, method: 'UPI' }, null),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
    expect((await svc.forWedding(weddingId, { seesCommission: true })).totals).toMatchObject({ paid: 70000, remaining: 20000 });
  });

  test('the older single payout can never be used on top of recorded payments', async () => {
    await app.prisma.vendorBooking.update({ where: { id: vbId }, data: { status: 'COMPLETED' } });
    expect((await errorOf(payouts.calculatePayoutForBooking(weddingId, vbId, null)))?.message).toContain('one by one');
    expect(await app.prisma.payout.count({ where: { vendorBookingId: vbId } })).toBe(0);
  });

  test('the founder’s outstanding figure counts confirmed work, and a cancelled work takes no payment', async () => {
    const company = await svc.companyTotals();
    expect(company.outstanding).toBeGreaterThanOrEqual(20000);
    expect(company.ledgerPaid).toBeGreaterThanOrEqual(70000);
    await app.prisma.vendorBooking.update({ where: { id: vbId }, data: { status: 'CANCELLED' } });
    expect((await errorOf(svc.record(weddingId, vbId, { amount: 1, paidOn: today, method: 'UPI' }, null)))?.message).toContain('confirmed');
    const { vendors } = await svc.forWedding(weddingId, { seesCommission: true });
    expect(vendors[0].works[0].money).toMatchObject({ owed: false, paid: 70000, remaining: -70000 }); // paid on work now cancelled: shown, never hidden
  });
});
