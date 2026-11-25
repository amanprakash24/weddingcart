/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Credit notes and invoice void (money design v1, PR 7, 25 Nov 2026) on a real database.
dbDescribe('Credit notes and cancelling an invoice (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let ws: typeof import('@/services/weddingWorkspace.service').weddingWorkspaceService;
  let iw: typeof import('@/services/invoiceWorkflow.service').invoiceWorkflowService;
  let pay: typeof import('@/services/payment.service').paymentService;
  let rec: typeof import('@/services/reconciliation.service').reconciliationService;
  let quotationId = '';
  let weddingId = '';
  let advanceId = '';
  let otherId = '';
  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;
  const financeOf = async () => (await ws.getWorkspace(weddingId)).finance;

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    ws = (await import('@/services/weddingWorkspace.service')).weddingWorkspaceService;
    iw = (await import('@/services/invoiceWorkflow.service')).invoiceWorkflowService;
    pay = (await import('@/services/payment.service')).paymentService;
    rec = (await import('@/services/reconciliation.service')).reconciliationService;
    const c = await fx.consultation({ name: 'DBTEST credit notes', weddingDate: '2027-07-01', guestCount: 150 });
    const q = await fx.acceptedQuote(c.id, { items: [fx.line('Stage decor', 40000), fx.line('Sangeet DJ', 10000)], advance: 12500 });
    quotationId = q.id;
    const booking = await app.quotationService.createBooking(q.id, {}, null);
    const money = await app.agreement.loadAgreementMoney(q.id);
    await app.commercialFlow.recordPaymentForQuotation(q.id, { amount: money.confirmationAmount, method: 'UPI' }, null);
    weddingId = (await app.prisma.wedding.findFirstOrThrow({ where: { sourceBookingId: booking.id } })).id;
    advanceId = (await app.prisma.invoice.findFirstOrThrow({ where: { quotationId, kind: 'ADVANCE' } })).id;
    const other = await ws.createInvoice(weddingId, { clientName: 'DBTEST couple', clientPhone: '9000000001', gstEnabled: false, gstAmount: 0, discount: 0, items: [{ description: 'DBTEST extra lights', amount: 6000, quantity: 1 }] }, null);
    otherId = other.id;
  });
  afterAll(async () => {
    if (fx) await fx.purge();
  });

  test('a credit note on the paid advance: the invoice is not edited, the agreement owes less, and the extra shows as owed back', async () => {
    const before = await app.agreement.loadAgreementMoney(quotationId);
    const { creditNote, refundOwed } = await iw.issueCreditNote(weddingId, advanceId, { amount: '1,000', reason: 'DBTEST smaller stage' }, null);
    expect(creditNote.number).toMatch(/^CN-\d{6}-\d{4}$/);
    expect(refundOwed).toBe(1000); // the advance was paid in full, so the credit is money owed back
    const inv = await app.prisma.invoice.findUniqueOrThrow({ where: { id: advanceId } });
    expect(inv.total).toBe(before.confirmationAmount);
    expect(inv.creditedAmount).toBe(1000);
    const after = await app.agreement.loadAgreementMoney(quotationId);
    expect(after.outstanding).toBe(before.outstanding - 1000);
    const f = await financeOf();
    expect(f.invoices.find((i) => i.id === advanceId)).toMatchObject({ creditedAmount: 1000, refundOwed: 1000, outstanding: 0, creditNotes: [{ amount: 1000, reason: 'DBTEST smaller stage' }] });
    expect(f.totals).toMatchObject({ credited: 1000, refundOwed: 1000 });
  });

  test('never above the invoice total — the app refuses, and so does the database; a credit note is never changed', async () => {
    const inv = await app.prisma.invoice.findUniqueOrThrow({ where: { id: advanceId } });
    expect((await errorOf(iw.issueCreditNote(weddingId, advanceId, { amount: inv.total, reason: 'DBTEST too much' }, null)))?.message).toContain('more than what is left');
    expect((await errorOf(app.prisma.creditNote.create({ data: { number: 'CN-TEST-1', invoiceId: advanceId, amount: inv.total, reason: 'DBTEST direct' } })))?.message).toContain('more than its total');
    expect((await errorOf(app.prisma.invoice.update({ where: { id: advanceId }, data: { creditedAmount: 0 } })))?.message).toContain('only through a credit note');
    const cn = await app.prisma.creditNote.findFirstOrThrow({ where: { invoiceId: advanceId } });
    expect((await errorOf(app.prisma.creditNote.update({ where: { id: cn.id }, data: { reason: 'changed' } })))?.message).toContain('cannot be changed');
  });

  test('an unissued invoice is not credited; the advance and balance are not cancelled', async () => {
    expect((await errorOf(iw.issueCreditNote(weddingId, otherId, { amount: 100, reason: 'DBTEST draft' }, null)))?.message).toContain('not issued');
    expect((await errorOf(iw.voidInvoice(weddingId, advanceId, { reason: 'DBTEST no' }, null)))?.message).toContain('credit note instead');
  });

  test('cancelling an unpaid invoice: frozen, counts for nothing, takes no payment or credit, hidden from the couple', async () => {
    await iw.issueInvoice(weddingId, otherId, null);
    const before = (await financeOf()).totals;
    expect((await errorOf(iw.voidInvoice(weddingId, otherId, { reason: ' ' }, null)))?.message).toContain('Say why');
    await iw.voidInvoice(weddingId, otherId, { reason: 'DBTEST raised twice' }, null);
    const f = await financeOf();
    expect(f.invoices.find((i) => i.id === otherId)).toMatchObject({ outstanding: 0, voidReason: 'DBTEST raised twice' });
    expect(f.totals.invoicedTotal).toBe(before.invoicedTotal - 6000);
    expect(f.totals.outstanding).toBe(before.outstanding - 6000);
    expect((await errorOf(iw.recordManualPayment(weddingId, otherId, { amount: 100, method: 'UPI' }, null)))?.message).toContain('cancelled');
    expect((await errorOf(app.prisma.payment.create({ data: { invoiceId: otherId, amount: 100, method: 'UPI', status: 'SUCCESS' } })))?.message).toContain('cancelled');
    expect((await errorOf(iw.issueCreditNote(weddingId, otherId, { amount: 100, reason: 'DBTEST void' }, null)))?.message).toContain('cancelled');
    expect((await errorOf(pay.createPaymentLinkForInvoice(weddingId, otherId, null)))?.message).toContain('cancelled');
    expect((await errorOf(app.prisma.invoice.update({ where: { id: otherId }, data: { notes: 'edited' } })))?.message).toContain('cannot be changed');
  });

  test('the database refuses to cancel an invoice with a payment', async () => {
    const paid = await ws.createInvoice(weddingId, { clientName: 'DBTEST couple', clientPhone: '9000000001', gstEnabled: false, gstAmount: 0, discount: 0, items: [{ description: 'DBTEST paid extra', amount: 3000, quantity: 1 }] }, null);
    await iw.recordManualPayment(weddingId, paid.id, { amount: 1000, method: 'CASH' }, null);
    expect((await errorOf(iw.voidInvoice(weddingId, paid.id, { reason: 'DBTEST has money' }, null)))?.message).toContain('credit note instead');
    expect((await errorOf(app.prisma.invoice.update({ where: { id: paid.id }, data: { voidedAt: new Date(), voidReason: 'DBTEST direct' } })))?.message).toContain('has payments');
    // a credit for the rest settles it: 1,000 paid + 2,000 credited = 3,000
    const { status } = await iw.issueCreditNote(weddingId, paid.id, { amount: 2000, reason: 'DBTEST rest waived' }, null);
    expect(status).toBe('PAID');
    expect((await errorOf(iw.recordManualPayment(weddingId, paid.id, { amount: 1, method: 'UPI' }, null)))?.message).toContain('fully paid');
  });

  test('the Money check agrees: credits match their notes, no cancelled invoice has a payment', async () => {
    const report = await rec.report();
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
    const mine = (id: string) => byId[id].items.filter((i) => i.ref.startsWith('INV')).filter((i) => i.detail.includes('DBTEST'));
    expect(byId['invoice-credits'].items).toEqual([]);
    expect(byId['invoice-void'].items).toEqual([]);
    expect(mine('invoice-status')).toEqual([]);
  });
});
