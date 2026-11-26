/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Confirming chosen services (money design v1, PR 8a, 26 Nov 2026) on a real database.
dbDescribe('Confirmations of chosen services (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let cs: typeof import('@/services/confirmation.service').confirmationService;
  let quotationId = '';
  let items: { id: string; description: string }[] = [];
  let first = '';
  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;
  const itemId = (d: string) => items.find((i) => i.description === d)!.id;

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    cs = (await import('@/services/confirmation.service')).confirmationService;
    const c = await fx.consultation({ name: 'DBTEST confirmations', weddingDate: '2027-08-01', guestCount: 200 });
    const q = await fx.sentQuote(c.id, { items: [fx.line('DBTEST Stage decor', 40000), fx.line('DBTEST Sangeet DJ', 10000), fx.line('DBTEST Photography', 30001)], advance: 20000, discount: 1001 });
    quotationId = q.id;
    items = await app.prisma.quotationItem.findMany({ where: { quotationId }, select: { id: true, description: true } });
  });
  afterAll(async () => {
    if (fx) await fx.purge();
  });

  test('confirming one service: its own frozen confirmation, agreement and 25% advance invoice; the quotation stays sent', async () => {
    const r = await cs.confirm(quotationId, { itemIds: [itemId('DBTEST Stage decor')], channel: 'CALL' }, null);
    first = r.confirmation.id;
    expect(r.confirmation.number).toMatch(/^CNF-\d{6}-\d{4}$/);
    expect(r.isLast).toBe(false);
    const q = await app.prisma.quotation.findUniqueOrThrow({ where: { id: quotationId } });
    expect(q.status).toBe('SENT');
    expect(q.advanceInvoiceId).toBeNull(); // the whole quotation's advance invoice is not made
    const agreement = await app.prisma.commercialAgreement.findUniqueOrThrow({ where: { confirmationId: first } });
    expect(agreement).toMatchObject({ agreementTotal: r.confirmation.total, confirmationAmount: r.confirmation.advance });
    const inv = await app.prisma.invoice.findFirstOrThrow({ where: { confirmationId: first, kind: 'ADVANCE' } });
    expect(inv.total).toBe(r.confirmation.advance);
    expect(r.confirmation.advance).toBe(Math.ceil(r.confirmation.total / 4));
  });

  test('a service is never confirmed twice — the app refuses, and so does the database', async () => {
    expect((await errorOf(cs.confirm(quotationId, { itemIds: [itemId('DBTEST Stage decor')], channel: 'CALL' }, null)))?.message).toContain('Already confirmed');
    const line = await app.prisma.confirmationLine.findFirstOrThrow({ where: { confirmationId: first } });
    const { id: _id, confirmationId: _c, ...copy } = line;
    expect((await errorOf(app.prisma.confirmationLine.create({ data: { ...copy, confirmationId: first } })))?.message).toMatch(/unique|one_live/i);
  });

  test('frozen: a confirmation’s figures and lines cannot be changed', async () => {
    expect((await errorOf(app.prisma.confirmation.update({ where: { id: first }, data: { total: 1 } })))?.message).toContain('frozen');
    const line = await app.prisma.confirmationLine.findFirstOrThrow({ where: { confirmationId: first } });
    expect((await errorOf(app.prisma.confirmationLine.update({ where: { id: line.id }, data: { unitPrice: 1 } })))?.message).toContain('frozen');
  });

  test('two confirmations keep their money apart; paying past the 25% makes that confirmation’s own balance invoice', async () => {
    const r = await cs.confirm(quotationId, { itemIds: [itemId('DBTEST Sangeet DJ')], channel: 'WHATSAPP' }, null);
    const firstTotal = (await app.prisma.confirmation.findUniqueOrThrow({ where: { id: first } })).total;
    await cs.recordPayment(quotationId, first, { amount: firstTotal - 100, method: 'UPI' }, null);
    const [one, two] = await cs.forQuotation(quotationId);
    expect(one.money).toMatchObject({ received: firstTotal - 100, outstanding: 100, state: 'CONFIRMED' });
    expect(two.money).toMatchObject({ received: 0, outstanding: r.confirmation.total, state: 'NOT_STARTED' });
    const bal = await app.prisma.invoice.findFirstOrThrow({ where: { confirmationId: first, kind: 'BALANCE' } });
    expect(bal.total).toBe(firstTotal - one.money.confirmationAmount);
    expect((await errorOf(cs.recordPayment(quotationId, first, { amount: 101, method: 'UPI' }, null)))?.message).toContain('more than the balance');
  });

  test('while partly confirmed the quotation is not accepted as a whole, declined, revised or expired', async () => {
    expect((await errorOf(app.quotationService.accept(quotationId, { channel: 'WHATSAPP', note: 'x' }, null)))?.message).toContain('confirmed');
    expect((await errorOf(app.quotationService.reject(quotationId, { reason: 'x' }, null)))?.message).toContain('confirmed');
    expect((await errorOf(app.quotationService.revise(quotationId, null)))?.message).toContain('confirmed');
    await app.prisma.quotation.update({ where: { id: quotationId }, data: { validUntil: new Date(Date.now() - 86_400_000) } });
    const { expireOverdue } = await import('@/services/quotation.service');
    await expireOverdue({ id: quotationId });
    expect((await app.prisma.quotation.findUniqueOrThrow({ where: { id: quotationId } })).status).toBe('SENT');
    await app.prisma.quotation.update({ where: { id: quotationId }, data: { validUntil: new Date(Date.now() + 10 * 86_400_000) } });
  });

  test('the last service: the confirmations add up to the quotation total exactly', async () => {
    const r = await cs.confirm(quotationId, { itemIds: [itemId('DBTEST Photography')], channel: 'IN_PERSON' }, null);
    expect(r.isLast).toBe(true);
    const all = await app.prisma.confirmation.findMany({ where: { quotationId } });
    const q = await app.prisma.quotation.findUniqueOrThrow({ where: { id: quotationId } });
    expect(all.reduce((s, c) => s + c.total, 0)).toBe(q.total);
    expect(all.reduce((s, c) => s + c.discount, 0)).toBe(q.discount);
  });

  test('a quotation booked as a whole cannot also be confirmed service by service; two confirmations at once of the same service: one wins', async () => {
    const c = await fx.consultation({ name: 'DBTEST whole', weddingDate: '2027-09-01', guestCount: 80 });
    const whole = await fx.bookedQuote(c.id, { items: [fx.line('DBTEST Venue', 50000), fx.line('DBTEST Food', 20000)], advance: 10000 });
    const wholeItem = await app.prisma.quotationItem.findFirstOrThrow({ where: { quotationId: whole.quotation.id } });
    expect((await errorOf(cs.confirm(whole.quotation.id, { itemIds: [wholeItem.id], channel: 'CALL' }, null)))?.message).toMatch(/booked as a whole|only a sent quotation/);

    const c2 = await fx.consultation({ name: 'DBTEST race', weddingDate: '2027-10-01', guestCount: 80 });
    const q2 = await fx.sentQuote(c2.id, { items: [fx.line('DBTEST Lights', 9000), fx.line('DBTEST Band', 9000)], advance: 1000 });
    const light = await app.prisma.quotationItem.findFirstOrThrow({ where: { quotationId: q2.id, description: 'DBTEST Lights' } });
    const results = await Promise.allSettled([1, 2, 3].map(() => cs.confirm(q2.id, { itemIds: [light.id], channel: 'CALL' }, null)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await app.prisma.confirmation.count({ where: { quotationId: q2.id } })).toBe(1);
    expect(await app.prisma.invoice.count({ where: { quotationId: q2.id } })).toBe(1);
  });

  test('a website lead (phone only, no name): services can be confirmed, and a whole quotation can be paid before a booking', async () => {
    // Regression (26 Nov 2026): the customer lookup asked a lead for a "name" it does not have, and threw.
    const lead = await app.prisma.lead.create({ data: { phone: '9000000099' } });
    const validUntil = new Date(Date.now() + 10 * 86_400_000);
    try {
      const a = await app.quotationService.create('LEAD', lead.id, { items: [fx.line('DBTEST Lead decor', 20000), fx.line('DBTEST Lead DJ', 8000)], advanceAmount: 5000, validUntil }, null);
      await app.quotationService.send(a.id, null);
      const decor = await app.prisma.quotationItem.findFirstOrThrow({ where: { quotationId: a.id, description: 'DBTEST Lead decor' } });
      const r = await cs.confirm(a.id, { itemIds: [decor.id], channel: 'CALL' }, null);
      expect(await app.prisma.commercialAgreement.findUniqueOrThrow({ where: { confirmationId: r.confirmation.id } })).toMatchObject({ customerName: '9000000099', customerPhone: '9000000099' });
      await cs.recordPayment(a.id, r.confirmation.id, { amount: r.confirmation.advance, method: 'UPI' }, null);
      expect((await cs.forQuotation(a.id))[0].money).toMatchObject({ received: r.confirmation.advance, state: 'CONFIRMED' });
    } finally {
      const qs = (await app.prisma.quotation.findMany({ where: { leadId: lead.id }, select: { id: true } })).map((q) => q.id);
      await app.prisma.payment.deleteMany({ where: { invoice: { quotationId: { in: qs } } } });
      await app.prisma.commercialAgreement.deleteMany({ where: { quotationId: { in: qs } } });
      await app.prisma.invoice.deleteMany({ where: { quotationId: { in: qs } } });
      await app.prisma.confirmation.deleteMany({ where: { quotationId: { in: qs } } });
      await app.prisma.quotation.deleteMany({ where: { id: { in: qs } } });
      await app.prisma.activityLog.deleteMany({ where: { leadId: lead.id } });
      await app.prisma.task.deleteMany({ where: { leadId: lead.id } });
      await app.prisma.lead.delete({ where: { id: lead.id } });
    }
  });

  test('a lead’s whole quotation can be paid against before a booking exists (was broken: the lead has no name)', async () => {
    const lead = await app.prisma.lead.create({ data: { phone: '9000000098' } });
    try {
      const q = await app.quotationService.create('LEAD', lead.id, { items: [fx.line('DBTEST Lead venue', 40000)], advanceAmount: 5000, validUntil: new Date(Date.now() + 10 * 86_400_000) }, null);
      await app.quotationService.send(q.id, null);
      await app.quotationService.accept(q.id, { channel: 'WHATSAPP', note: 'db test' }, null);
      await app.agreement.recordAgreementPayment(q.id, { amount: 10000, method: 'UPI' }, null);
      expect(await app.prisma.commercialAgreement.findFirstOrThrow({ where: { quotationId: q.id, confirmationId: null } })).toMatchObject({ customerName: '9000000098', confirmationAmount: 10000 });
    } finally {
      const qs = (await app.prisma.quotation.findMany({ where: { leadId: lead.id }, select: { id: true } })).map((x) => x.id);
      await app.prisma.payment.deleteMany({ where: { invoice: { quotationId: { in: qs } } } });
      await app.prisma.quotation.updateMany({ where: { id: { in: qs } }, data: { advanceInvoiceId: null } });
      await app.prisma.commercialAgreement.deleteMany({ where: { quotationId: { in: qs } } });
      await app.prisma.invoice.deleteMany({ where: { quotationId: { in: qs } } });
      await app.prisma.quotation.deleteMany({ where: { id: { in: qs } } });
      await app.prisma.activityLog.deleteMany({ where: { leadId: lead.id } });
      await app.prisma.task.deleteMany({ where: { leadId: lead.id } });
      await app.prisma.lead.delete({ where: { id: lead.id } });
    }
  });

  test('the Money check reads each confirmation against its own invoices', async () => {
    const report = await (await import('@/services/reconciliation.service')).reconciliationService.report();
    const sums = report.checks.find((c) => c.id === 'agreement-invoices')!;
    expect(sums.items.filter((i) => i.ref.includes('CNF-'))).toEqual([]);
  });
});
