/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Finance audit log (money design v1, PR 2, 25 Nov 2026) on a real database: the triggers record every money change with the row before
// and after; who acted comes from auditAs; the log refuses to be changed or emptied; the reconciliation report runs on real rows.
dbDescribe('Finance audit log and reconciliation (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let weddingId = '';
  let vbId = '';
  let actor = ''; // a real user: payments keep who recorded them (a foreign key)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;
  const events = (table: string, rowId: string) => app.prisma.financeEvent.findMany({ where: { tableName: table, rowId }, orderBy: { id: 'asc' } });

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    actor = (await app.prisma.user.findFirstOrThrow({ select: { id: true }, orderBy: { createdAt: 'asc' } })).id;
    const [vendor] = await fx.vendors(1);
    const c = await fx.consultation({ name: 'DBTEST finance audit', weddingDate: '2027-03-01', guestCount: 200 });
    const q = await fx.acceptedQuote(c.id, { items: [fx.line('Decoration package', 50000, 1, vendor.id)], advance: 12500 });
    const booking = await app.quotationService.createBooking(q.id, {}, null);
    const money = await app.agreement.loadAgreementMoney(q.id);
    await app.commercialFlow.recordPaymentForQuotation(q.id, { amount: money.confirmationAmount, method: 'UPI' }, actor);
    weddingId = (await app.prisma.wedding.findFirstOrThrow({ where: { sourceBookingId: booking.id } })).id;
    vbId = (await app.prisma.vendorBooking.findFirstOrThrow({ where: { weddingEvent: { weddingId } } })).id;
  });
  afterAll(async () => {
    if (app && vbId) await app.prisma.vendorPayment.deleteMany({ where: { vendorBookingId: vbId } });
    if (fx) await fx.purge();
  });

  test('a payment recorded by a person is logged with who it was', async () => {
    const payment = await app.prisma.payment.findFirstOrThrow({ where: { invoice: { weddingId } }, orderBy: { createdAt: 'desc' } });
    const [ins] = await events('payments', payment.id);
    expect(ins).toMatchObject({ action: 'INSERT', actorId: actor, tableName: 'payments' });
    expect((ins.after as { amount: number }).amount).toBe(payment.amount);
  });

  test('a vendor payment and its void: two events, the void showing exactly what changed', async () => {
    await app.prisma.vendorBooking.update({ where: { id: vbId }, data: { status: 'CONFIRMED' } });
    const { vendorPaymentService } = await import('@/services/vendorPayment.service');
    const p = await vendorPaymentService.record(weddingId, vbId, { amount: 1000, paidOn: today, method: 'UPI' }, actor);
    await vendorPaymentService.voidPayment(weddingId, p.id, 'DBTEST typed the wrong amount', actor);
    const log = await events('vendor_payments', p.id);
    expect(log.map((e) => [e.action, e.actorId])).toEqual([['INSERT', actor], ['UPDATE', actor]]);
    expect(log[1].changed).toEqual(['voidReason', 'voidedAt', 'voidedById']);
    expect((log[1].before as { voidedAt: string | null }).voidedAt).toBeNull();
  });

  test('a change made without auditAs is still logged — with no person (unattributed)', async () => {
    await app.prisma.vendorBooking.update({ where: { id: vbId }, data: { agreedPrice: 49000 } });
    const last = (await events('vendor_bookings', vbId)).at(-1)!;
    expect(last).toMatchObject({ action: 'UPDATE', actorId: null, changed: ['agreedPrice'] });
    expect([(last.before as { agreedPrice: number }).agreedPrice, (last.after as { agreedPrice: number }).agreedPrice]).toEqual([50000, 49000]);
  });

  test('a write that changes nothing but updatedAt is not logged', async () => {
    const before = (await events('vendor_bookings', vbId)).length;
    await app.prisma.vendorBooking.update({ where: { id: vbId }, data: { agreedPrice: 49000 } });
    expect((await events('vendor_bookings', vbId)).length).toBe(before);
  });

  test('the log can only grow: update, delete and truncate are refused by the database', async () => {
    const one = await app.prisma.financeEvent.findFirstOrThrow({ where: { tableName: 'vendor_bookings', rowId: vbId } });
    expect((await errorOf(app.prisma.financeEvent.update({ where: { id: one.id }, data: { actorId: 'tampered' } })))?.message).toContain('append-only');
    expect((await errorOf(app.prisma.financeEvent.delete({ where: { id: one.id } })))?.message).toContain('append-only');
    expect((await errorOf(app.prisma.$executeRawUnsafe('TRUNCATE "finance_events"')))?.message).toContain('append-only');
    expect(await app.prisma.financeEvent.count({ where: { id: one.id } })).toBe(1);
  });

  test('the reconciliation report runs on real rows and shows this wedding’s vendor work as agreeing', async () => {
    const { reconciliationService } = await import('@/services/reconciliation.service');
    const report = await reconciliationService.report();
    expect(report.counts.invoices).toBeGreaterThan(0);
    expect(report.checks.map((c) => c.id)).toContain('vendor-sides-agree');
    expect(report.checks.find((c) => c.id === 'vendor-sides-agree')?.status).toBe('ok');
    const unattributed = report.checks.find((c) => c.id === 'audit-unattributed')!;
    expect(unattributed.items.some((i) => i.ref === 'vendor_bookings')).toBe(true); // the direct update above
  });
});
