/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, inDays, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';
import { computeNextAction } from '@/lib/wedding/stage';

// COMMERCIAL FLOW V1 — the exact scenario, through the real services against a real (staging) database. No mocks, and nothing that
// talks to the outside world: no payment link is created and no message is sent.
//
//   QTN-1 ₹1,25,000 → revise → QTN-2 ₹1,18,000 → revise → QTN-3 ₹1,10,000 → customer accepts QTN-3 → booking confirmed
//   → wedding created → invoice created
//
// It also pins the rejection cases, the Terms & Conditions rules and the invoice lifecycle.
//
// Money V1 (22 Sep 2026): a booking is confirmed only once 25% of the accepted quotation has been received, and the booking's advance
// invoice (that 25%) exists from the moment the booking is created. So the story below pays the confirmation amount before it confirms.
// The invoice-lifecycle tests further down run on a booking made BEFORE that rule (no agreement), which keeps the old flow exactly —
// the historical behaviour they pin is unchanged and still supported.
dbDescribe('Commercial flow V1 (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let venueId = '';
  let createdCategoryId: string | null = null;
  const venueTermsV1 = 'DBTEST venue terms v1: 50% refundable if cancelled 30 days before; no outside DJ.';
  const venueTermsV2 = 'DBTEST venue terms v2: NON-refundable. (changed after the quotations were made)';

  let consultationId = '';
  let q1 = '';
  let q2 = '';
  let q3 = '';
  let bookingId = '';
  let weddingId = '';
  let advanceInvoiceId = '';
  let legacyQuoteId = ''; // the accepted quotation of the booking made before Money V1 (used by the invoice-lifecycle tests)

  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;
  const stageOf = async () => (await app.prisma.consultation.findUniqueOrThrow({ where: { id: consultationId } })).pipelineStage;
  const quoteRow = (id: string) => app.prisma.quotation.findUniqueOrThrow({ where: { id }, include: { items: true } });

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    // A venue of our own, with default terms — never an existing vendor's row.
    let category = await app.prisma.category.findFirst({ where: { name: { contains: 'enue', mode: 'insensitive' } } });
    if (!category) {
      category = await app.prisma.category.create({ data: { slug: `dbtest-venues-${fx.runId}`, name: 'DBTEST Venues', icon: 'x', description: 'x', image: 'x' } });
      createdCategoryId = category.id;
    }
    const venue = await app.prisma.vendor.create({
      data: { slug: `dbtest-venue-${fx.runId}`, name: `DBTEST Venue ${fx.runId}`, categoryId: category.id, city: 'Patna', priceMin: 1, priceMax: 2, image: 'x', description: 'x', defaultTerms: venueTermsV1 },
    });
    venueId = venue.id;
    consultationId = (await fx.consultation({ name: 'DBTEST Commercial Rahul & Priya', weddingDate: '2026-12-05', guestCount: 400 })).id;
  });
  afterAll(async () => {
    if (!fx) return;
    await fx.purge();
    if (venueId) await app.prisma.vendor.deleteMany({ where: { id: venueId } });
    if (createdCategoryId) await app.prisma.category.deleteMany({ where: { id: createdCategoryId } });
  });

  const line = (description: string, unitPrice: number, quantity = 1, vendorId?: string) => fx.line(description, unitPrice, quantity, vendorId);

  // ---------------------------------------------------------------- quotation versions and the lead's stage

  test('QTN-1 ₹1,25,000 is created with the venue\'s default terms COPIED in, sent, and the lead reads Quotation Sent', async () => {
    const q = await app.quotationService.create(
      'CONSULTATION',
      consultationId,
      { items: [line('Banquet hall hire', 60000, 1, venueId), line('Catering', 250, 150), line('Decoration', 20000), line('Photography', 12500)], discount: 5000, advanceAmount: 50000, validUntil: inDays(10) },
      null
    );
    q1 = q.id;
    expect(q.total).toBe(125000);
    expect(q.terms).toBe(venueTermsV1); // nobody typed terms: the venue's default was copied
    expect(await stageOf()).toBe('NEW');
    await app.quotationService.send(q1, null);
    expect((await quoteRow(q1)).status).toBe('SENT');
    expect(await stageOf()).toBe('QUOTATION_SENT');
  });

  test('changing the venue\'s default terms afterwards does not touch the existing quotation', async () => {
    await app.prisma.vendor.update({ where: { id: venueId }, data: { defaultTerms: venueTermsV2 } });
    expect((await quoteRow(q1)).terms).toBe(venueTermsV1);
  });

  test('revise → QTN-2 ₹1,18,000: a new draft copying the commercial fields and the PREVIOUS quotation\'s terms; the lead reads Negotiation', async () => {
    const revision = await app.quotationService.revise(q1, null);
    q2 = revision.id;
    expect(revision.revision).toBe(2);
    expect(revision.status).toBe('DRAFT');
    expect(revision.validUntil).toBeNull(); // must be re-entered
    expect(revision.terms).toBe(venueTermsV1); // NOT the venue's new v2
    expect(await stageOf()).toBe('NEGOTIATION');
    expect((await quoteRow(q1)).status).toBe('SUPERSEDED');

    await app.quotationService.update(q2, {
      items: [line('Banquet hall hire', 60000, 1, venueId), line('Catering', 250, 150), line('Decoration', 13000), line('Photography', 12500)],
      discount: 5000, advanceAmount: 50000, validUntil: inDays(10), terms: venueTermsV1,
    });
    const sent = await app.quotationService.send(q2, null);
    expect(sent.quotation.total).toBe(118000);
    expect(await stageOf()).toBe('NEGOTIATION'); // sending the revision does not move it back
  });

  test('revise again → QTN-3 ₹1,10,000', async () => {
    q3 = (await app.quotationService.revise(q2, null)).id;
    await app.quotationService.update(q3, {
      items: [line('Banquet hall hire', 60000, 1, venueId), line('Catering', 200, 150), line('Decoration', 13000), line('Photography', 12500)],
      discount: 5500, advanceAmount: 50000, validUntil: inDays(10), terms: venueTermsV1,
    });
    await app.quotationService.send(q3, null);
    const [n1, n2, n3] = await Promise.all([q1, q2, q3].map(quoteRow));
    expect([n1.total, n2.total, n3.total]).toEqual([125000, 118000, 110000]);
    expect([n1.status, n2.status, n3.status]).toEqual(['SUPERSEDED', 'SUPERSEDED', 'SENT']);
    expect([n1.revision, n2.revision, n3.revision]).toEqual([1, 2, 3]);
    expect(n2.supersedesId).toBe(q1);
    expect(n3.supersedesId).toBe(q2);
    // all three are still listed, newest first
    expect((await app.quotationService.listForSource('CONSULTATION', consultationId)).map((q) => q.id)).toEqual([q3, q2, q1]);
  });

  // ---------------------------------------------------------------- rejection cases (before acceptance)

  test('a superseded quotation cannot be accepted, revised, edited or sent', async () => {
    expect((await errorOf(app.quotationService.accept(q1, { channel: 'WHATSAPP' }, null)))?.message).toContain('Only a sent quotation can be accepted (this one is superseded)');
    expect((await errorOf(app.quotationService.accept(q2, { channel: 'WHATSAPP' }, null)))?.message).toContain('superseded');
    expect((await errorOf(app.quotationService.revise(q1, null)))?.message).toContain('already replaced by a newer revision');
    expect((await errorOf(app.quotationService.update(q1, { items: [line('x', 1)] })))?.message).toContain('no longer be edited');
    expect((await errorOf(app.quotationService.send(q1, null)))?.message).toContain('Only a draft quotation can be sent');
    expect(await stageOf()).toBe('NEGOTIATION'); // none of that moved the lead
  });

  // ---------------------------------------------------------------- customer acceptance

  test('the customer accepts QTN-3: it is accepted, the lead reads "Accepted — booking pending", and nothing else is created', async () => {
    const accepted = await app.quotationService.accept(q3, { channel: 'WHATSAPP', note: 'said yes' }, null);
    expect(accepted.status).toBe('ACCEPTED');
    expect(await stageOf()).toBe('ACCEPTED');
    expect((await quoteRow(q1)).status).toBe('SUPERSEDED');
    expect((await quoteRow(q2)).status).toBe('SUPERSEDED');
    expect(await app.prisma.booking.count({ where: { consultationId } })).toBe(0);
    expect(await app.prisma.wedding.count({ where: { sourceConsultationId: consultationId } })).toBe(0);
    expect(await app.prisma.invoice.count({ where: { quotationId: q3 } })).toBe(0);
  });

  test('an accepted quotation cannot normally be revised, edited, rejected, accepted again or replaced', async () => {
    expect((await errorOf(app.quotationService.revise(q3, null)))?.message).toContain('An accepted quotation cannot be revised');
    expect((await errorOf(app.quotationService.update(q3, { items: [line('x', 1)] })))?.message).toContain('no longer be edited');
    expect((await errorOf(app.quotationService.reject(q3, { reason: 'x' }, null)))?.message).toContain('Only a sent quotation can be rejected');
    expect((await errorOf(app.quotationService.accept(q3, { channel: 'PHONE' }, null)))?.message).toContain('Only a sent quotation can be accepted');
    expect((await errorOf(app.quotationService.create('CONSULTATION', consultationId, { items: [line('x', 1)] }, null)))?.message).toContain('already has an accepted quotation');
  });

  test('a lead\'s stage cannot be set to Accepted or Booked by hand', async () => {
    const { leadWorkspaceService } = app;
    const other = await fx.consultation({ name: 'DBTEST Commercial manual stage' });
    for (const toStage of ['ACCEPTED', 'WON'] as const) {
      const error = await errorOf(leadWorkspaceService.transitionStage('CONSULTATION', other.id, { toStage, actorId: null }));
      expect(error?.name).toBe('InvalidTransitionError');
    }
  });

  // ---------------------------------------------------------------- booking

  test('the booking is created FROM the accepted quotation: same total, references QTN-3; a second booking is refused', async () => {
    const booking = await app.quotationService.createBooking(q3, {}, null);
    bookingId = booking.id;
    expect(booking.status).toBe('NEW');
    expect(booking.total).toBe(110000);
    expect(booking.quotationId).toBe(q3);
    expect(await stageOf()).toBe('ACCEPTED'); // still pending until it is confirmed
    // Money V1: the agreement is frozen now (25% of ₹1,10,000 = ₹27,500, not the ₹50,000 typed as the quotation's advance) and the
    // booking's invoice exists, for exactly that amount, before any wedding does.
    expect(await app.prisma.commercialAgreement.findUniqueOrThrow({ where: { quotationId: q3 } })).toMatchObject({ bookingId: booking.id, agreementTotal: 110000, confirmationAmount: 27500, confirmationPercent: 25, holdWindowDays: 7 });
    expect(await app.prisma.invoice.findMany({ where: { quotationId: q3 } })).toMatchObject([{ kind: 'ADVANCE', total: 27500, bookingId: booking.id, weddingId: null, status: 'DRAFT' }]);
    expect((await errorOf(app.quotationService.createBooking(q3, {}, null)))?.message).toContain('A booking was already created from this quotation');
    expect(await app.prisma.booking.count({ where: { quotationId: q3 } })).toBe(1);
  });

  // ---------------------------------------------------------------- booking confirmed → wedding → invoice

  test('confirming before 25% is received is refused with the exact amount still needed — no wedding, no second invoice, the lead still reads Accepted', async () => {
    const error = await errorOf(app.bookingService.update(bookingId, { status: 'CONFIRMED' }));
    expect(error?.message).toBe('₹27,500 more required to confirm this booking.');
    expect(await app.prisma.wedding.count({ where: { sourceBookingId: bookingId } })).toBe(0);
    expect(await app.prisma.invoice.count({ where: { quotationId: q3 } })).toBe(1);
    expect(await stageOf()).toBe('ACCEPTED');
  });

  test('booking confirmed (25% received) → wedding created → the lead reads Booked → the SAME invoice, with its payment, belongs to the wedding', async () => {
    await app.agreement.recordAgreementPayment(q3, { amount: 27500, method: 'CASH' }, null);
    await app.bookingService.update(bookingId, { status: 'CONFIRMED' }); // what the confirm action writes first
    const wedding = await app.convertBookingToWedding(bookingId); // …and then converts
    weddingId = wedding.id;

    expect(wedding.sourceBookingId).toBe(bookingId);
    expect(wedding.status).toBe('PLANNING');
    expect(await stageOf()).toBe('WON'); // displays as "Booked"

    const invoices = await app.prisma.invoice.findMany({ where: { weddingId }, include: { payments: true } });
    expect(invoices).toHaveLength(1);
    const inv = invoices[0];
    expect(inv).toMatchObject({ kind: 'ADVANCE', quotationId: q3, bookingId, status: 'PAID', total: 27500, subtotal: 27500, gstEnabled: false, gstAmount: 0 });
    expect(inv.payments).toHaveLength(1);
    expect(inv.issuedAt).not.toBeNull();
    // the quotation points back at it (the idempotency anchor) and is still the accepted one
    const quote = await quoteRow(q3);
    expect(quote.advanceInvoiceId).toBe(inv.id);
    expect(quote.status).toBe('ACCEPTED');
    // no invoice hangs off an older version
    expect(await app.prisma.invoice.count({ where: { quotationId: { in: [q1, q2] } } })).toBe(0);
  });

  test('confirming again is a no-op: same wedding, no second booking, no second invoice', async () => {
    const again = await app.convertBookingToWedding(bookingId);
    expect(again.id).toBe(weddingId);
    expect(await app.prisma.invoice.count({ where: { weddingId } })).toBe(1);
    expect(await app.prisma.booking.count({ where: { quotationId: q3 } })).toBe(1);
    expect(await app.prisma.wedding.count({ where: { sourceBookingId: bookingId } })).toBe(1);
  });

  test('the wedding\'s Money shows the accepted agreement: QTN-3, its figures, its lines and the terms that were accepted', async () => {
    const { finance } = await app.weddingWorkspaceService.getWorkspace(weddingId);
    // Money V1: the advance is the frozen confirmation amount (25%), not the quotation's typed advance of ₹50,000.
    expect(finance.agreement).toMatchObject({ quotationId: q3, quotationNumber: (await quoteRow(q3)).quotationNumber, revision: 3, bookingId, total: 110000, advance: 27500, balance: 82500, hasBalanceInvoice: false });
    expect(finance.agreement?.money).toMatchObject({ bookingConfirmed: true, received: 27500, confirmationAmount: 27500, outstanding: 82500 });
    expect(finance.agreement?.lines).toHaveLength(4);
    expect(finance.agreement?.terms).toBe(venueTermsV1); // NOT the venue's current v2
    expect(finance.invoices[0]).toMatchObject({ kind: 'ADVANCE', quotationId: q3, bookingId });
  });

  test('the venue\'s later terms change altered nothing historical: the accepted quotation, the booking and the invoice', async () => {
    expect((await app.prisma.vendor.findUniqueOrThrow({ where: { id: venueId } })).defaultTerms).toBe(venueTermsV2);
    expect((await quoteRow(q3)).terms).toBe(venueTermsV1);
    expect((await quoteRow(q1)).terms).toBe(venueTermsV1);
    expect((await app.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).total).toBe(110000);
  });

  test('an OLD quotation can never generate an invoice', async () => {
    const { ensureAdvanceInvoice } = await import('@/services/advanceInvoice.service');
    const wedding = await app.prisma.wedding.findUniqueOrThrow({ where: { id: weddingId } });
    const { quotationRepository } = await import('@/repositories/quotation.repository');
    const old = await quotationRepository.findById(q1);
    const created = await app.prisma.$transaction((tx) =>
      ensureAdvanceInvoice(tx, { wedding, quotation: old, client: { name: 'x', phone: '9', city: 'Patna' }, bookingId, actorId: null })
    );
    expect(created).toBeNull(); // superseded → skipped
    expect(await app.prisma.invoice.count({ where: { weddingId } })).toBe(1);
  });

  // ---------------------------------------------------------------- invoice lifecycle (on a booking made BEFORE Money V1)

  test("a booking made before Money V1 (no agreement) still converts as it always did: a DRAFT advance invoice from the quotation's own advance", async () => {
    const c = await fx.consultation({ name: 'DBTEST Commercial before-the-rule booking' });
    const accepted = await fx.acceptedQuote(c.id, { items: [line('Banquet hall hire', 110000, 1, venueId)], advance: 50000 });
    legacyQuoteId = accepted.id;
    const booking = await app.prisma.booking.create({
      data: {
        name: 'DBTEST Legacy', phone: '9000000000', city: 'Patna', total: 110000, status: 'CONFIRMED', weddingDate: new Date('2026-12-05T00:00:00Z'),
        quotation: { connect: { id: legacyQuoteId } }, consultation: { connect: { id: c.id } },
        items: { create: [{ vendorId: venueId, vendorName: 'DBTEST Venue', vendorCategory: 'Venue', packageName: 'Banquet hall hire', price: 110000, quantity: 1 }] },
      },
    });
    bookingId = booking.id;
    const wedding = await app.convertBookingToWedding(booking.id);
    weddingId = wedding.id;
    const inv = await app.prisma.invoice.findFirstOrThrow({ where: { weddingId } });
    advanceInvoiceId = inv.id;
    expect(inv).toMatchObject({ kind: 'ADVANCE', quotationId: legacyQuoteId, bookingId, status: 'DRAFT', total: 50000, gstEnabled: false, gstAmount: 0 });
    expect(inv.issuedAt).toBeNull();
    expect(await app.prisma.commercialAgreement.count({ where: { quotationId: legacyQuoteId } })).toBe(0);
  });

  test('next action follows the real invoice state: draft → "Send advance invoice"; issued → "Advance payment … pending"', async () => {
    const ws = await app.weddingWorkspaceService.getWorkspace(weddingId);
    const input = (invoices: typeof ws.finance.invoices) => ({
      status: ws.wedding.status, primaryDate: ws.wedding.primaryDate, functionDates: ws.events.map((e) => e.date), now: new Date(),
      coordinatorName: 'X', guestCount: 400, couple: { brideName: 'a', groomName: 'b' }, tasks: [], vendorBookings: [],
      invoices: invoices.map((i) => ({ status: i.status, outstanding: i.outstanding, isAdvance: i.kind === 'ADVANCE' })),
    });
    expect(computeNextAction(input(ws.finance.invoices)).title).toBe('Send advance invoice');

    await app.invoiceWorkflowService.issueInvoice(weddingId, advanceInvoiceId, null);
    const issued = await app.weddingWorkspaceService.getWorkspace(weddingId);
    expect(issued.finance.invoices[0].status).toBe('SENT');
    expect(issued.finance.invoices[0].issuedAt).not.toBeNull();
    expect(computeNextAction(input(issued.finance.invoices)).title).toBe('Advance payment of ₹50,000 pending');
  });

  test('issuing twice is refused', async () => {
    expect((await errorOf(app.invoiceWorkflowService.issueInvoice(weddingId, advanceInvoiceId, null)))?.message).toContain('already been issued');
  });

  test('manual payments: never more than the balance; a part payment is PARTIALLY_PAID; the rest is PAID; then nothing more', async () => {
    const pay = (amount: number, method: 'CASH' | 'UPI' = 'CASH') => app.invoiceWorkflowService.recordManualPayment(weddingId, advanceInvoiceId, { amount, method, reference: 'RCPT-1' }, null);
    expect((await errorOf(pay(50001)))?.message).toContain('more than the balance due');
    expect((await errorOf(pay(0)))?.message).toContain('whole rupees');

    const part = await pay(20000);
    expect(part).toMatchObject({ status: 'PARTIALLY_PAID', balance: 30000 });
    expect((await app.prisma.invoice.findUniqueOrThrow({ where: { id: advanceInvoiceId } })).status).toBe('PARTIALLY_PAID');
    const payment = await app.prisma.payment.findFirstOrThrow({ where: { invoiceId: advanceInvoiceId } });
    expect(payment).toMatchObject({ amount: 20000, method: 'CASH', razorpayPaymentId: null, status: 'SUCCESS' });

    const rest = await pay(30000, 'UPI');
    expect(rest).toMatchObject({ status: 'PAID', balance: 0 });
    expect((await errorOf(pay(1)))?.message).toContain('already fully paid');
    const ws = await app.weddingWorkspaceService.getWorkspace(weddingId);
    expect(ws.finance.invoices[0]).toMatchObject({ status: 'PAID', amountPaid: 50000, outstanding: 0 });
  });

  test('a payment cannot be recorded against another wedding\'s invoice', async () => {
    const error = await errorOf(app.invoiceWorkflowService.recordManualPayment('00000000-0000-0000-0000-000000000000', advanceInvoiceId, { amount: 1, method: 'CASH' }, null));
    expect(error?.name).toBe('NotFoundError');
  });

  test('the balance invoice comes from the accepted quotation only (total − advance), once', async () => {
    const balance = await app.invoiceWorkflowService.createBalanceInvoice(weddingId, null);
    expect(balance).toMatchObject({ kind: 'BALANCE', quotationId: legacyQuoteId, bookingId, status: 'DRAFT', total: 60000, gstEnabled: false });
    expect(balance.items.map((i) => `${i.description}|${i.amount}`)).toEqual([`Balance — ${(await quoteRow(legacyQuoteId)).quotationNumber}|60000`]);
    expect((await errorOf(app.invoiceWorkflowService.createBalanceInvoice(weddingId, null)))?.message).toContain('already created');
    // the database itself also refuses a second one
    const dup = await errorOf(
      app.prisma.invoice.create({ data: { invoiceNumber: `INV-DBTEST-${fx.runId}`, clientName: 'DBTEST dup', clientPhone: '9', subtotal: 1, total: 1, kind: 'BALANCE', quotationId: legacyQuoteId, weddingId } })
    );
    expect(dup).not.toBeNull();
    expect(await app.prisma.invoice.count({ where: { quotationId: legacyQuoteId, kind: 'BALANCE' } })).toBe(1);
  });

  test('issuing an invoice while a payment is being recorded never leaves a part-paid invoice showing "Sent" (found in the browser test)', async () => {
    for (let i = 0; i < 4; i++) {
      const inv = await app.prisma.invoice.create({
        data: { invoiceNumber: `INV-DBTEST-RACE-${fx.runId}-${i}`, clientName: 'DBTEST race', clientPhone: '9000000000', subtotal: 50000, total: 50000, status: 'DRAFT', weddingId },
      });
      const results = await Promise.allSettled([
        app.invoiceWorkflowService.issueInvoice(weddingId, inv.id, null),
        app.invoiceWorkflowService.recordManualPayment(weddingId, inv.id, { amount: 20000, method: 'CASH' }, null),
      ]);
      expect(results[1].status).toBe('fulfilled'); // the payment is never lost
      const row = await app.prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: { payments: true } });
      expect(row.payments).toHaveLength(1);
      expect(row.status).toBe('PARTIALLY_PAID'); // whichever came first, the money is reflected
      expect(row.issuedAt).not.toBeNull();
      if (results[0].status === 'rejected') expect((results[0].reason as Error).message).toContain('already been issued'); // lost the race: told so, not silently
    }
  });

  // ---------------------------------------------------------------- the old standalone Invoices screen

  test('the old screen is told this customer already has a wedding (and a stranger is not)', async () => {
    const { findWeddingsForClientPhone } = await import('@/services/invoiceWorkflow.service');
    const found = await findWeddingsForClientPhone('9000000000');
    expect(found.map((w) => w.id)).toContain(weddingId);
    expect(await findWeddingsForClientPhone('9111111111')).toEqual([]);
    expect(await findWeddingsForClientPhone('123')).toEqual([]);
  });

  // ---------------------------------------------------------------- CRM path (a lead with no booking)

  test('CRM path: accepted → the lead reads Accepted → refused until 25% is received → wedding created → Booked, and its invoice (with the payment) belongs to the accepted quotation', async () => {
    const c = await fx.consultation({ name: 'DBTEST Commercial CRM path' });
    const accepted = await fx.acceptedQuote(c.id, { advance: 40000 }); // ₹3,00,000 → ₹75,000 is what the rule requires (not the ₹40,000 typed)
    expect((await app.prisma.consultation.findUniqueOrThrow({ where: { id: c.id } })).pipelineStage).toBe('ACCEPTED');
    const input = { weddingDate: new Date('2026-12-05T00:00:00Z'), city: 'Patna' };
    expect((await errorOf(app.convertLeadToWedding('CONSULTATION', c.id, input, null)))?.message).toBe('₹75,000 more required to confirm this booking.');
    await app.agreement.recordAgreementPayment(accepted.id, { amount: 75000, method: 'CASH' }, null);
    const wedding = await app.convertLeadToWedding('CONSULTATION', c.id, input, null);
    expect((await app.prisma.consultation.findUniqueOrThrow({ where: { id: c.id } })).pipelineStage).toBe('WON');
    const inv = await app.prisma.invoice.findFirstOrThrow({ where: { weddingId: wedding.id } });
    expect(inv).toMatchObject({ kind: 'ADVANCE', quotationId: accepted.id, bookingId: null, total: 75000, status: 'PAID' });
  });
});
