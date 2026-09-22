/// <reference types="bun-types" />
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Money V1 against the real (staging) database: the 25% confirmation rule end to end.
//   accepted quotation → booking created (agreement frozen, advance invoice = 25%) → part payment (date held) → 25% received →
//   booking confirmed → wedding created (the same invoices attach to it).
// Nothing here talks to the outside world: payments are recorded by "staff", no Razorpay, no WhatsApp.
dbDescribe('Money V1 — the 25% confirmation rule (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let vendorId = '';
  let staffId = '';

  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;
  const days = (n: number) => new Date(Date.now() + n * 86_400_000);

  // A ₹2,00,000 accepted quotation (one venue line) with a deliberately DIFFERENT free-form "advance" (₹1,00,000) — the rule, not the
  // quotation's advance, must decide what is required.
  async function acceptedQuote(name: string, total = 200000) {
    const c = await fx.consultation({ name: `DBTEST ${name}`, weddingDate: '2027-03-15', guestCount: 300 });
    const q = await fx.acceptedQuote(c.id, { items: [fx.line('Banquet hall hire', total, 1, vendorId, 'Venue')], advance: Math.floor(total / 2) });
    return { consultation: c, quotation: q };
  }
  async function booked(name: string, total = 200000) {
    const { consultation, quotation } = await acceptedQuote(name, total);
    const booking = await app.quotationService.createBooking(quotation.id, {}, null);
    return { consultation, quotation, booking };
  }
  const agreementOf = (quotationId: string) => app.prisma.commercialAgreement.findUniqueOrThrow({ where: { quotationId } });
  const invoicesOf = (quotationId: string) => app.prisma.invoice.findMany({ where: { quotationId }, include: { payments: true }, orderBy: { createdAt: 'asc' } });
  const money = (quotationId: string) => app.agreement.loadAgreementMoney(quotationId);
  const pay = (quotationId: string, amount: number, extra: Record<string, unknown> = {}) =>
    app.commercialFlow.recordPaymentForQuotation(quotationId, { amount, method: 'UPI', ...extra }, staffId);
  const weddingOf = (bookingId: string) => app.prisma.wedding.findFirst({ where: { sourceBookingId: bookingId } });

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    [{ id: vendorId }] = await fx.vendors(1);
    const staff = await app.prisma.user.findFirst({ where: { roles: { some: { role: { in: ['SUPER_ADMIN', 'SALES', 'OPERATIONS'] } } } }, select: { id: true } });
    if (!staff) throw new Error('the staging database needs at least one staff user');
    staffId = staff.id;
  });
  afterAll(async () => {
    if (fx) await fx.purge();
  });

  describe('booking created: the agreement is frozen and the advance invoice is the 25%', () => {
    test('₹2,00,000 → ₹50,000 required, rule values stored, accepted lines kept with their quotation-item ids; the invoice belongs to the quotation and booking, not yet to a wedding', async () => {
      const { quotation, booking } = await booked('Agreement A');
      const a = await agreementOf(quotation.id);
      expect(a).toMatchObject({
        bookingId: booking.id, quotationRevision: 1, currency: 'INR', agreementTotal: 200000, confirmationPercent: 25, confirmationAmount: 50000,
        confirmationRounding: 'CEIL_RUPEE', holdWindowDays: 7, holdStartedAt: null, confirmedAt: null,
      });
      const items = a.itemsSnapshot as { itemId: string; unitPrice: number; quantity: number; total: number }[];
      const quoteItems = await app.prisma.quotationItem.findMany({ where: { quotationId: quotation.id } });
      expect(items.map((i) => i.itemId)).toEqual(quoteItems.map((i) => i.id));
      expect(items[0]).toMatchObject({ unitPrice: 200000, quantity: 1, total: 200000 });

      const invoices = await invoicesOf(quotation.id);
      expect(invoices).toHaveLength(1);
      expect(invoices[0]).toMatchObject({ kind: 'ADVANCE', total: 50000, quotationId: quotation.id, bookingId: booking.id, weddingId: null, status: 'DRAFT' });
      expect((await app.prisma.quotation.findUniqueOrThrow({ where: { id: quotation.id } })).advanceInvoiceId).toBe(invoices[0].id);
      expect(await weddingOf(booking.id)).toBeNull();
    });

    test('the quotation\'s own free-form advance no longer decides anything: the invoice is ₹50,000, not the ₹1,00,000 typed on the quote', async () => {
      const { quotation } = await booked('Agreement B');
      expect((await app.prisma.quotation.findUniqueOrThrow({ where: { id: quotation.id } })).advanceAmount).toBe(100000);
      expect((await invoicesOf(quotation.id))[0].total).toBe(50000);
    });

    test('rounds UP to the rupee: ₹1,00,001 → ₹25,001', async () => {
      const { quotation } = await booked('Agreement C', 100001);
      expect((await agreementOf(quotation.id)).confirmationAmount).toBe(25001);
    });

    test('creating it twice creates nothing twice', async () => {
      const { quotation } = await booked('Agreement D');
      await app.prisma.$transaction((tx) => app.agreement.ensureAgreementInTx(tx, { quotationId: quotation.id, actorId: null }));
      expect(await app.prisma.commercialAgreement.count({ where: { quotationId: quotation.id } })).toBe(1);
      expect(await invoicesOf(quotation.id)).toHaveLength(1);
    });

    test('a later change to the accepted terms or prices, or to the rule stored on the agreement, is not picked up by an existing deal', async () => {
      const { quotation, booking } = await booked('Agreement E');
      const before = await agreementOf(quotation.id);
      // Simulates every way something upstream could change later (edited directly in the database, since an accepted quotation cannot be
      // edited through the app): the accepted terms and the accepted line price.
      await app.prisma.quotation.update({ where: { id: quotation.id }, data: { terms: 'CHANGED TERMS v2' } });
      await app.prisma.quotationItem.updateMany({ where: { quotationId: quotation.id }, data: { unitPrice: 999999 } });
      const after = await agreementOf(quotation.id);
      expect(after.termsSnapshot).toBe(before.termsSnapshot);
      expect(after.termsSnapshot ?? '').not.toContain('CHANGED');
      expect(after.itemsSnapshot).toEqual(before.itemsSnapshot);
      expect(after).toMatchObject({ agreementTotal: 200000, confirmationAmount: 50000 });
      // The stored rule (30%) — not the current default — is what the gate uses for this deal.
      await app.prisma.commercialAgreement.update({ where: { id: after.id }, data: { confirmationPercent: 30, confirmationAmount: 60000 } });
      await pay(quotation.id, 50000);
      expect((await money(quotation.id)).state).toBe('DATE_HELD'); // ₹50,000 would have confirmed a 25% deal
      expect((await errorOf(app.bookingService.update(booking.id, { status: 'CONFIRMED' })))?.message).toBe('₹10,000 more required to confirm this booking.');
    });
  });

  describe('the confirmation gate — below 25% nothing is created', () => {
    test('confirming with nothing received is refused, says how much is needed, and creates no wedding, no second invoice, no status change', async () => {
      const { quotation, booking } = await booked('Gate A');
      const err = await errorOf(app.bookingService.update(booking.id, { status: 'CONFIRMED' }));
      expect(err?.name).toBe('ConflictError');
      expect(err?.message).toBe('₹50,000 more required to confirm this booking.');
      expect((await app.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('NEW');
      expect(await weddingOf(booking.id)).toBeNull();
      expect(await invoicesOf(quotation.id)).toHaveLength(1);
    });

    test('even a booking somehow marked CONFIRMED cannot become a wedding early — conversion re-checks', async () => {
      const { quotation, booking } = await booked('Gate B');
      await app.prisma.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED' } }); // bypassing the service on purpose
      const err = await errorOf(app.convertBookingToWedding(booking.id));
      expect(err?.message).toBe('₹50,000 more required to confirm this booking.');
      expect(await weddingOf(booking.id)).toBeNull();
      expect(await invoicesOf(quotation.id)).toHaveLength(1);
    });

    test('the CRM conversion path obeys the same rule — and ignores a "token advance received" claim', async () => {
      const { consultation, quotation } = await acceptedQuote('Gate C');
      const input = { weddingDate: new Date('2027-03-15T00:00:00Z'), city: 'Patna', tokenAdvanceReceived: true };
      const err = await errorOf(app.convertLeadToWedding('CONSULTATION', consultation.id, input, null));
      expect(err?.name).toBe('ConflictError');
      expect(err?.message).toBe('₹50,000 more required to confirm this booking.');
      expect(await app.prisma.wedding.count({ where: { sourceConsultationId: consultation.id } })).toBe(0);
      // the agreement + its (only) advance invoice now exist, ready to be paid against — refusing never duplicates them
      expect(await invoicesOf(quotation.id)).toHaveLength(1);
      const again = await errorOf(app.convertLeadToWedding('CONSULTATION', consultation.id, input, null));
      expect(again?.message).toBe('₹50,000 more required to confirm this booking.');
      expect(await invoicesOf(quotation.id)).toHaveLength(1);
    });
  });

  describe('part payment holds the date; reaching 25% confirms the booking and creates the wedding', () => {
    test('₹20,000 → Date Held, ₹30,000 remaining, 7 of 7 days; the hold starts once and never restarts; a second part payment adds up', async () => {
      const { quotation, booking } = await booked('Hold A');
      const first = await pay(quotation.id, 20000, { reference: 'UTR-100', paidAt: new Date() });
      expect(first.confirmation.attempted).toBe(false); // not enough yet
      let m = await money(quotation.id);
      expect(m).toMatchObject({ state: 'DATE_HELD', received: 20000, remaining: 30000, daysLeft: 7, overdue: false, bookingConfirmed: false, readyToConfirm: false, outstanding: 180000 });
      const startedAt = (await agreementOf(quotation.id)).holdStartedAt;
      expect(startedAt).not.toBeNull();
      expect((await agreementOf(quotation.id)).holdExpiresAt?.getTime()).toBe((startedAt as Date).getTime() + 7 * 86_400_000);
      expect(m.payments[0]).toMatchObject({ amount: 20000, method: 'UPI', reference: 'UTR-100', invoiceNumber: (await invoicesOf(quotation.id))[0].invoiceNumber });
      expect(m.payments[0].recordedByName).not.toBeNull();
      expect((await app.prisma.payment.findFirstOrThrow({ where: { invoice: { quotationId: quotation.id } } })).recordedById).toBe(staffId);

      const err = await errorOf(app.bookingService.update(booking.id, { status: 'CONFIRMED' }));
      expect(err?.message).toBe('₹30,000 more required to confirm this booking.');

      await pay(quotation.id, 10000);
      m = await money(quotation.id);
      expect(m).toMatchObject({ state: 'DATE_HELD', received: 30000, remaining: 20000 });
      expect((await agreementOf(quotation.id)).holdStartedAt).toEqual(startedAt); // the window did not restart
      expect(await weddingOf(booking.id)).toBeNull();
    });

    test('the payment that reaches exactly ₹50,000 confirms the booking and creates the wedding; the SAME invoice (with its payments) moves onto it', async () => {
      const { consultation, quotation, booking } = await booked('Confirm A');
      await pay(quotation.id, 20000);
      const advanceBefore = (await invoicesOf(quotation.id))[0];
      const done = await pay(quotation.id, 30000);
      expect(done.confirmation).toMatchObject({ attempted: true, confirmed: true, error: null });

      const b = await app.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(b.status).toBe('CONFIRMED');
      const wedding = await weddingOf(booking.id);
      expect(wedding).not.toBeNull();
      const invoices = await invoicesOf(quotation.id);
      expect(invoices).toHaveLength(1); // no second advance invoice
      expect(invoices[0]).toMatchObject({ id: advanceBefore.id, weddingId: wedding!.id, kind: 'ADVANCE', status: 'PAID', total: 50000 });
      expect(invoices[0].payments.map((p) => p.amount).sort()).toEqual([20000, 30000]); // history intact
      expect((await agreementOf(quotation.id)).confirmedAt).not.toBeNull();
      expect((await app.prisma.consultation.findUniqueOrThrow({ where: { id: consultation.id } })).pipelineStage).toBe('WON');
      expect(await app.prisma.activityLog.findFirst({ where: { weddingId: wedding!.id, summary: { startsWith: 'Booking confirmed' } } })).not.toBeNull();

      const m = await money(quotation.id);
      expect(m).toMatchObject({ bookingConfirmed: true, weddingId: wedding!.id, received: 50000, outstanding: 150000, stateLabel: 'Booking confirmed' });
    });

    test('retrying confirmation cannot create a second wedding, invoice or conversion', async () => {
      const { quotation, booking } = await booked('Retry A');
      await pay(quotation.id, 50000);
      const wedding = await weddingOf(booking.id);
      await app.bookingService.update(booking.id, { status: 'CONFIRMED' }); // the confirm button is also the retry — already confirmed passes quietly
      const again = await app.convertBookingToWedding(booking.id);
      expect(again.id).toBe(wedding!.id);
      expect(await app.prisma.wedding.count({ where: { sourceBookingId: booking.id } })).toBe(1);
      expect(await invoicesOf(quotation.id)).toHaveLength(1);
      expect(await app.prisma.payment.count({ where: { invoice: { quotationId: quotation.id } } })).toBe(1);
    });

    test('the workspace of the new wedding carries the frozen figures and the same money card', async () => {
      const { quotation, booking } = await booked('Workspace A');
      await pay(quotation.id, 20000);
      await pay(quotation.id, 30000);
      const wedding = (await weddingOf(booking.id))!;
      const ws = await app.weddingWorkspaceService.getWorkspace(wedding.id);
      expect(ws.finance.agreement).toMatchObject({ total: 200000, advance: 50000, balance: 150000 });
      expect(ws.finance.agreement?.money).toMatchObject({ state: 'CONFIRMED', bookingConfirmed: true, received: 50000, confirmationAmount: 50000, outstanding: 150000 });
      expect(ws.finance.invoices[0].payments.map((p) => p.recordedByName)).toEqual([expect.any(String), expect.any(String)]);
    });
  });

  describe('25% is a minimum, not a maximum', () => {
    test('₹70,000 in one payment: ₹50,000 on the advance invoice, ₹20,000 on a balance invoice made for it — every total stays exact, booking confirmed', async () => {
      const { quotation, booking } = await booked('Above A');
      const r = await pay(quotation.id, 70000, { reference: 'UTR-70' });
      expect(r.splits).toEqual([{ invoiceNumber: expect.any(String), amount: 50000 }, { invoiceNumber: expect.any(String), amount: 20000 }]);
      expect(r.confirmation.confirmed).toBe(true);
      const invoices = await invoicesOf(quotation.id);
      expect(invoices.map((i) => [i.kind, i.total, i.status, i.payments.reduce((s, p) => s + p.amount, 0)])).toEqual([['ADVANCE', 50000, 'PAID', 50000], ['BALANCE', 150000, 'PARTIALLY_PAID', 20000]]);
      const rows = invoices.flatMap((i) => i.payments);
      expect(new Set(rows.map((p) => p.receiptId)).size).toBe(1); // one receipt, two rows
      expect(rows.every((p) => p.reference === 'UTR-70')).toBe(true);
      const wedding = (await weddingOf(booking.id))!;
      expect(invoices.every((i) => i.weddingId === wedding.id)).toBe(true);
      expect(await money(quotation.id)).toMatchObject({ received: 70000, outstanding: 130000, bookingConfirmed: true });
    });

    test('later payments go to the balance until the agreement is fully paid; more than owed, or after that, is refused', async () => {
      const { quotation } = await booked('Above B');
      await pay(quotation.id, 70000);
      expect((await errorOf(pay(quotation.id, 130001)))?.message).toBe('The amount is more than the balance due (₹1,30,000)');
      await pay(quotation.id, 100000);
      await pay(quotation.id, 30000);
      const invoices = await invoicesOf(quotation.id);
      expect(invoices.map((i) => i.status)).toEqual(['PAID', 'PAID']);
      expect(await money(quotation.id)).toMatchObject({ received: 200000, outstanding: 0, next: { kind: 'DONE' } });
      expect((await errorOf(pay(quotation.id, 1)))?.message).toBe('This agreement is already fully paid');
    });

    test('a balance invoice made by hand measures from the frozen ₹50,000 (not the quotation\'s ₹1,00,000 advance)', async () => {
      const { quotation, booking } = await booked('Above C');
      await pay(quotation.id, 50000);
      const wedding = (await weddingOf(booking.id))!;
      const balance = await app.invoiceWorkflowService.createBalanceInvoice(wedding.id, staffId);
      expect(balance.total).toBe(150000);
      const r = await pay(quotation.id, 40000); // goes onto that same balance invoice
      expect(r.splits).toHaveLength(1);
      expect((await invoicesOf(quotation.id)).filter((i) => i.kind === 'BALANCE')).toHaveLength(1);
    });
  });

  describe('safety', () => {
    test('a form submitted twice (same key) records the payment once; the same UTR again is refused', async () => {
      const { quotation } = await booked('Safe A');
      const key = `key-${Date.now()}-a`;
      const first = await pay(quotation.id, 20000, { idempotencyKey: key, reference: 'UTR-DUP' });
      const second = await pay(quotation.id, 20000, { idempotencyKey: key, reference: 'UTR-DUP' });
      expect(second.duplicate).toBe(true);
      expect(second.receiptId).toBe(first.receiptId);
      expect(await app.prisma.payment.count({ where: { invoice: { quotationId: quotation.id } } })).toBe(1);
      expect((await errorOf(pay(quotation.id, 5000, { reference: 'utr-dup', idempotencyKey: `key-${Date.now()}-b` })))?.message).toContain('already recorded');
      expect(await app.prisma.payment.count({ where: { invoice: { quotationId: quotation.id } } })).toBe(1);
    });

    test('two people recording at once can never together exceed what is owed', async () => {
      const { quotation } = await booked('Safe B');
      const results = await Promise.allSettled([pay(quotation.id, 150000), pay(quotation.id, 150000)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await money(quotation.id)).received).toBe(150000);
    });

    test('bad amounts and unknown methods are refused; an invoice of the agreement cannot also be paid the old per-invoice way', async () => {
      const { quotation, booking } = await booked('Safe C');
      expect((await errorOf(pay(quotation.id, 0)))?.name).toBe('ValidationError');
      expect((await errorOf(pay(quotation.id, 10.5)))?.name).toBe('ValidationError');
      expect((await errorOf(app.commercialFlow.recordPaymentForQuotation(quotation.id, { amount: 1000, method: 'BITCOIN' as never }, staffId)))?.name).toBe('ValidationError');
      await pay(quotation.id, 50000);
      const wedding = (await weddingOf(booking.id))!;
      const advance = (await invoicesOf(quotation.id))[0];
      const err = await errorOf(app.invoiceWorkflowService.recordManualPayment(wedding.id, advance.id, { amount: 1000, method: 'CASH' }, staffId));
      expect(err?.name).toBe('ConflictError');
    });

    test('a quotation that is not accepted has no agreement: paying against it is refused', async () => {
      const c = await fx.consultation({ name: 'DBTEST Not accepted' });
      const sent = await fx.sentQuote(c.id, { items: [fx.line('Hall', 100000, 1, vendorId, 'Venue')] });
      const err = await errorOf(pay(sent.id, 10000));
      expect(err?.name).toBe('ConflictError');
    });
  });

  describe('the 7-day hold window', () => {
    test('after 7 days without reaching 25% the booking stays Date Held and is flagged overdue — nothing is released, cancelled or refunded; payment history is intact', async () => {
      const { quotation, booking } = await booked('Overdue A');
      await pay(quotation.id, 20000);
      const ninety = days(-9);
      await app.prisma.commercialAgreement.update({ where: { quotationId: quotation.id }, data: { holdStartedAt: ninety, holdExpiresAt: new Date(ninety.getTime() + 7 * 86_400_000) } });
      const m = await money(quotation.id);
      expect(m).toMatchObject({ state: 'DATE_HELD', overdue: true, remaining: 30000, bookingConfirmed: false });
      expect(m.daysLeft).toBeLessThan(0);
      expect(m.message).toContain('decide');
      expect((await app.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('NEW'); // nothing auto-cancelled
      expect(await app.prisma.payment.count({ where: { invoice: { quotationId: quotation.id } } })).toBe(1);
    });

    test('a payment received after the window still counts and, once 25% is in, confirms the booking', async () => {
      const { quotation, booking } = await booked('Overdue B');
      await pay(quotation.id, 20000);
      const ago = days(-10);
      await app.prisma.commercialAgreement.update({ where: { quotationId: quotation.id }, data: { holdStartedAt: ago, holdExpiresAt: new Date(ago.getTime() + 7 * 86_400_000) } });
      const r = await pay(quotation.id, 30000);
      expect(r.confirmation.confirmed).toBe(true);
      expect(await weddingOf(booking.id)).not.toBeNull();
      expect((await money(quotation.id)).overdue).toBe(false);
    });
  });

  describe('CRM path (no booking): the payment is recorded against the accepted quotation, then staff create the wedding', () => {
    test('first payment lazily creates the agreement; 25% makes it ready; the wedding is created only by staff and takes the invoice with its payments', async () => {
      const { consultation, quotation } = await acceptedQuote('Crm A');
      expect(await app.prisma.commercialAgreement.count({ where: { quotationId: quotation.id } })).toBe(0);
      const first = await pay(quotation.id, 20000);
      expect(first.money.exists).toBe(true);
      expect(await invoicesOf(quotation.id)).toHaveLength(1);
      const done = await pay(quotation.id, 30000);
      expect(done.confirmation.attempted).toBe(false); // no booking to confirm
      expect(done.money).toMatchObject({ readyToConfirm: true, bookingConfirmed: false, state: 'CONFIRMED' });
      expect(await app.prisma.wedding.count({ where: { sourceConsultationId: consultation.id } })).toBe(0);

      const wedding = await app.convertLeadToWedding('CONSULTATION', consultation.id, { weddingDate: new Date('2027-03-15T00:00:00Z'), city: 'Patna' }, staffId);
      const invoices = await invoicesOf(quotation.id);
      expect(invoices).toHaveLength(1);
      expect(invoices[0]).toMatchObject({ weddingId: wedding.id, status: 'PAID', total: 50000 });
      expect(invoices[0].payments).toHaveLength(2);
      expect((await app.prisma.consultation.findUniqueOrThrow({ where: { id: consultation.id } })).pipelineStage).toBe('WON');
      expect(await money(quotation.id)).toMatchObject({ bookingConfirmed: true, weddingId: wedding.id });
    });
  });

  describe('paid before the booking exists (a consultation whose customer pays first)', () => {
    test('creating the booking afterwards attaches it to the SAME agreement and invoice — no second of either — and the booking then confirms', async () => {
      const { quotation } = await acceptedQuote('Pay first A');
      await pay(quotation.id, 50000); // the agreement + its invoice are made by this payment (no booking yet)
      const before = await agreementOf(quotation.id);
      expect(before.bookingId).toBeNull();
      const invoiceBefore = (await invoicesOf(quotation.id))[0];

      const booking = await app.quotationService.createBooking(quotation.id, {}, null);
      const after = await agreementOf(quotation.id);
      expect(after).toMatchObject({ id: before.id, bookingId: booking.id });
      const invoices = await invoicesOf(quotation.id);
      expect(invoices).toHaveLength(1);
      expect(invoices[0]).toMatchObject({ id: invoiceBefore.id, bookingId: booking.id, status: 'PAID' });
      expect((await money(quotation.id)).bookingId).toBe(booking.id);

      await app.bookingService.update(booking.id, { status: 'CONFIRMED' }); // 25% is already in
      const wedding = await app.convertBookingToWedding(booking.id);
      expect((await invoicesOf(quotation.id))[0].weddingId).toBe(wedding.id);
      expect(await app.prisma.payment.count({ where: { invoice: { quotationId: quotation.id } } })).toBe(1);
    });
  });

  describe('history and other bookings are left alone', () => {
    test('a booking made before the rule (no agreement, advance invoice made at conversion) still converts exactly as before', async () => {
      const { quotation } = await acceptedQuote('Legacy A');
      const src = await app.prisma.quotation.findUniqueOrThrow({ where: { id: quotation.id } });
      const booking = await app.prisma.booking.create({
        data: { name: 'DBTEST Legacy', phone: '9000000001', city: 'Patna', total: src.total, status: 'CONFIRMED', weddingDate: new Date('2027-03-15T00:00:00Z'), quotation: { connect: { id: quotation.id } }, consultation: { connect: { id: src.consultationId as string } }, items: { create: [{ vendorId, vendorName: 'v', vendorCategory: 'Venue', packageName: 'Banquet hall hire', price: src.total, quantity: 1 }] } },
      });
      const wedding = await app.convertBookingToWedding(booking.id);
      expect(await app.prisma.commercialAgreement.count({ where: { quotationId: quotation.id } })).toBe(0);
      const invoices = await invoicesOf(quotation.id);
      expect(invoices).toHaveLength(1);
      expect(invoices[0]).toMatchObject({ kind: 'ADVANCE', weddingId: wedding.id, total: src.advanceAmount }); // the quotation's own advance, as it always was
      const ws = await app.weddingWorkspaceService.getWorkspace(wedding.id);
      expect(ws.finance.agreement?.money).toBeNull();
      expect(ws.finance.agreement?.advance).toBe(src.advanceAmount);
    });

    test('a marketplace booking with no quotation is confirmed exactly as before', async () => {
      const booking = await app.prisma.booking.create({ data: { name: 'DBTEST Cart', phone: '9000000002', city: 'Patna', total: 50000, status: 'NEW' } });
      const updated = await app.bookingService.update(booking.id, { status: 'CONFIRMED' });
      expect(updated.status).toBe('CONFIRMED');
      await app.prisma.booking.delete({ where: { id: booking.id } });
    });
  });
});
