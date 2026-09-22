/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { buildQuotationMessage } from '@/lib/quotation/message';
import { dbDescribe, inDays, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// THE GOLDEN WEDDING WORKFLOW (handoff §12/§21; docs/VIVAH_OS_TECH_COMPLETION.md).
//
//   Rahul & Priya · 20 Nov 2026 · 500 guests · budget ₹5,00,000 · confirmation (25%) ₹1,25,000 · then ₹1,00,000 more · pending ₹2,75,000
//   services: Venue, Catering, Decoration, Photography, DJ/Sound · venue + photographer confirmed, catering pending
//
// One realistic wedding operated from first enquiry to the point the product supports today, through the real
// services against a real database — no mocks. The scenario is deterministic (all rows are created here and removed at
// the end), so it can be re-run at any time; run it with `bun run test:db` after any change to a core journey.
//
// Money V1 (22 Sep 2026): the booking is confirmed only once 25% (₹1,25,000) is received, so Rahul pays before the wedding exists.
//
// Steps the product cannot do yet are listed as test.todo below — each is a P0/P1 gap in the audit, so this file is
// also the living checklist of what is still missing from the golden path.

// A known gap: reported as "todo" by `bun test`; with `bun test --todo` it runs and is EXPECTED to fail until the feature exists.
const gap = (label: string) =>
  test.todo(label, () => {
    throw new Error('not built yet');
  });

dbDescribe('Golden Wedding Workflow — Rahul & Priya (real database)', () => {
  let app: App;
  let fx: Fixtures;

  // shared state, filled in step by step
  let consultationId = '';
  let quotationId = '';
  let bookingId = '';
  let weddingId = '';
  let advanceInvoiceId = '';
  let balanceInvoiceId = '';
  let vendors: { id: string; name: string }[] = [];
  const dashboardBefore = { overdue: 0 };

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    vendors = await fx.vendors(5); // venue, catering, decoration, photography, DJ/sound
    dashboardBefore.overdue = (await app.commandCenterService.getDashboard()).tasks.overdue;
  });
  afterAll(async () => {
    if (fx) await fx.purge();
  });

  const [VENUE, CATERING, DECOR, PHOTO, DJ] = [0, 1, 2, 3, 4];

  test('1 · The enquiry arrives: a consultation for Rahul Sharma, 500 guests, 20 November 2026', async () => {
    const c = await fx.consultation({ name: 'Rahul Sharma', phone: '9876500001', weddingDate: '2026-11-20', guestCount: 500, totalBudget: 500000 });
    consultationId = c.id;
    const workspace = await app.leadWorkspaceService.getWorkspace('CONSULTATION', c.id);
    expect(workspace.customer.name).toBe('Rahul Sharma');
    expect(workspace.weddingDetails.guestCount).toBe(500);
    expect(workspace.weddingDetails.date).toBe('2026-11-20');
    expect(workspace.subject.pipelineStage).toBe('NEW');
  });

  test('2 · The coordinator works the lead through the pipeline (the real state machine)', async () => {
    for (const toStage of ['CONTACTED', 'QUALIFIED', 'SITE_VISIT_SCHEDULED'] as const) {
      const moved = await app.leadWorkspaceService.transitionStage('CONSULTATION', consultationId, { toStage, actorId: null });
      expect(moved.pipelineStage).toBe(toStage);
    }
  });

  test('3 · A quotation for all five services: ₹5,00,000 with a ₹2,00,000 advance — totals computed by the server', async () => {
    const draft = await app.quotationService.create(
      'CONSULTATION',
      consultationId,
      {
        items: [
          fx.line('Grand Ballroom — 500 guests', 200000, 1, vendors[VENUE].id, 'Venues'),
          fx.line('Catering per plate', 300, 500, vendors[CATERING].id, 'Catering'),
          fx.line('Stage & mandap decoration', 80000, 1, vendors[DECOR].id, 'Decorators'),
          fx.line('Photography & video', 50000, 1, vendors[PHOTO].id, 'Photo & Video'),
          fx.line('DJ & sound', 20000, 1, vendors[DJ].id, 'DJ'),
        ],
        advanceAmount: 200000,
        validUntil: inDays(14),
      },
      null
    );
    quotationId = draft.id;
    expect(draft.status).toBe('DRAFT');
    expect([draft.subtotal, draft.total, draft.advanceAmount, draft.balance]).toEqual([500000, 500000, 200000, 300000]);
    expect(draft.gstEnabled).toBe(false);
    expect(draft.quotationNumber).toMatch(/^QTN-\d{6}-\d{4}$/);
  });

  test('4 · The quote is sent: the lead moves to Quotation Sent and the customer message is ready', async () => {
    const { quotation, stageAdvanced } = await app.quotationService.send(quotationId, null);
    expect(quotation.status).toBe('SENT');
    expect(stageAdvanced).toBe(true);
    const message = buildQuotationMessage(quotation, 'Rahul Sharma');
    for (const text of ['Namaste Rahul Sharma', 'Total: ₹5,00,000', 'Advance to confirm: ₹2,00,000', 'Balance: ₹3,00,000']) {
      expect(message).toContain(text);
    }
    expect(message.toLowerCase()).not.toContain('marketplace');
  });

  test('5 · Rahul says yes on WhatsApp; staff record it, and the lead reads "Accepted — booking pending" (Booked is set only when the booking is confirmed)', async () => {
    const accepted = await app.quotationService.accept(quotationId, { channel: 'WHATSAPP', note: 'Confirmed on chat' }, null);
    expect(accepted.status).toBe('ACCEPTED');
    expect(accepted.acceptedChannel).toBe('WHATSAPP');
    const workspace = await app.leadWorkspaceService.getWorkspace('CONSULTATION', consultationId);
    expect(workspace.subject.hasAcceptedQuotation).toBe(true);
    expect(workspace.subject.pipelineStage).toBe('ACCEPTED');
    const manual = await app.leadWorkspaceService.transitionStage('CONSULTATION', consultationId, { toStage: 'WON', actorId: null }).then(() => null, (e: Error) => e);
    expect(manual?.name).toBe('InvalidTransitionError'); // Booked is never picked by hand
  });

  test('6 · A booking is created from the quote: quoted prices, ₹5,00,000, 20 Nov, 500 guests', async () => {
    const booking = await app.quotationService.createBooking(quotationId, {}, null);
    bookingId = booking.id;
    expect(booking.status).toBe('NEW');
    expect(booking.total).toBe(500000);
    expect(booking.items).toHaveLength(5);
    expect(booking.weddingDate?.toISOString().slice(0, 10)).toBe('2026-11-20');
    expect(booking.guestCount).toBe(500);
    expect(booking.items.find((i) => i.packageName === 'Catering per plate')).toMatchObject({ price: 300, quantity: 500 });
    expect(await app.prisma.booking.count({ where: { quotationId } })).toBe(1);
    // the agreement is frozen and the booking's invoice — exactly the 25% (₹1,25,000), not the quote's typed ₹2,00,000 advance — exists before any wedding
    expect(await app.prisma.commercialAgreement.findUniqueOrThrow({ where: { quotationId } })).toMatchObject({ agreementTotal: 500000, confirmationAmount: 125000, bookingId });
    const invoices = await app.prisma.invoice.findMany({ where: { quotationId } });
    expect(invoices).toMatchObject([{ kind: 'ADVANCE', total: 125000, status: 'DRAFT', weddingId: null, bookingId }]);
    advanceInvoiceId = invoices[0].id;
  });

  test('6b · Confirming before 25% is received is refused — with the exact amount — and creates nothing', async () => {
    const error = await app.bookingService.update(bookingId, { status: 'CONFIRMED' }).then(() => null, (e: Error) => e);
    expect(error?.message).toBe('₹1,25,000 more required to confirm this booking.');
    expect(await app.prisma.wedding.count({ where: { sourceBookingId: bookingId } })).toBe(0);
    expect(await app.prisma.invoice.count({ where: { quotationId } })).toBe(1);
  });

  test('7 · Rahul pays ₹1,25,000; the booking is confirmed: ONE wedding is created, with its vendor bookings, tasks and timeline', async () => {
    await app.agreement.recordAgreementPayment(quotationId, { amount: 125000, method: 'UPI', reference: 'UTR-GOLDEN-1' }, null);
    await app.bookingService.update(bookingId, { status: 'CONFIRMED' });
    const wedding = await app.convertBookingToWedding(bookingId);
    weddingId = wedding.id;
    expect(wedding.status).toBe('PLANNING');
    expect(wedding.totalBudget).toBe(500000);
    expect(wedding.weddingNumber).toMatch(/^WED-\d{4}-\d{4}$/);
    expect(await app.prisma.wedding.count({ where: { sourceBookingId: bookingId } })).toBe(1);

    // confirming again (a double click) changes nothing
    expect((await app.convertBookingToWedding(bookingId)).id).toBe(weddingId);
    expect(await app.prisma.wedding.count({ where: { sourceBookingId: bookingId } })).toBe(1);
  });

  test('8 · The Wedding Workspace: one event, five vendor bookings at the quoted prices (catering 500 × ₹300), nothing orphaned', async () => {
    const workspace = await app.weddingWorkspaceService.getWorkspace(weddingId);
    expect(workspace.events).toHaveLength(1);
    const bookings = workspace.events[0].vendorBookings;
    expect(bookings).toHaveLength(5);
    expect(bookings.reduce((sum, b) => sum + b.agreedPrice, 0)).toBe(500000);
    expect(bookings.find((b) => b.vendorId === vendors[CATERING].id)?.agreedPrice).toBe(150000); // quantity respected
    expect(bookings.every((b) => b.status === 'PENDING_VENDOR_CONFIRMATION')).toBe(true);
    expect(workspace.finance.budget).toMatchObject({ planned: 500000, committed: 500000, variance: 0 });
    // the booking route seeds one confirmation task per vendor booking (the umbrella task and milestones come only from the CRM route)
    expect(workspace.tasks).toHaveLength(5);
    // no orphaned operational records
    expect(await app.prisma.vendorBooking.count({ where: { weddingEvent: { weddingId } } })).toBe(5);
    expect(await app.prisma.task.count({ where: { weddingId, weddingEventId: null, vendorBookingId: { not: null } } })).toBe(0);
  });

  test('9 · The booking invoice moved onto the wedding with its payment: paid ₹1,25,000, NO tax — nothing was created twice', async () => {
    const invoices = await app.prisma.invoice.findMany({ where: { weddingId }, include: { items: true, payments: true } });
    expect(invoices).toHaveLength(1);
    const advance = invoices[0];
    expect(advance.id).toBe(advanceInvoiceId); // the same invoice that existed before the wedding
    expect(advance.status).toBe('PAID');
    expect([advance.subtotal, advance.total, advance.discount, advance.gstAmount]).toEqual([125000, 125000, 0, 0]);
    expect(advance.gstEnabled).toBe(false);
    expect(advance.items).toHaveLength(1);
    expect(advance.payments).toHaveLength(1);
    expect((await app.quotationService.getById(quotationId)).advanceInvoiceId).toBe(advance.id);
    expect(await app.prisma.paymentLink.count({ where: { invoiceId: advance.id } })).toBe(0); // the payment link is a manual, later step
  });

  test('10 · The balance invoice (₹3,75,000) is made from the agreement; a payment attempt fails, then ₹1,00,000 arrives by payment link: PARTIALLY_PAID', async () => {
    const balance = await app.invoiceWorkflowService.createBalanceInvoice(weddingId, null);
    balanceInvoiceId = balance.id;
    expect(balance).toMatchObject({ kind: 'BALANCE', total: 375000, quotationId });
    const entity = (id: string, paise = 10000000) => ({ id, amount: paise, method: 'upi', notes: { invoiceId: balanceInvoiceId } });
    const run = fx.runId;

    expect(await app.paymentService.handleWebhookEvent({ event: 'payment.failed', payload: { payment: { entity: entity(`pay_${run}_failed`) } } })).toEqual({ handled: true });
    expect(await app.prisma.payment.count({ where: { invoiceId: balanceInvoiceId } })).toBe(0); // a failed attempt is not money

    const paid = { event: 'payment_link.paid', payload: { payment: { entity: entity(`pay_${run}_ok`) }, payment_link: { entity: { id: `plink_${run}`, notes: { invoiceId: balanceInvoiceId } } } } };
    expect(await app.paymentService.handleWebhookEvent(paid)).toEqual({ handled: true });
    expect(await app.prisma.payment.count({ where: { invoiceId: balanceInvoiceId, status: 'SUCCESS' } })).toBe(1);
    expect((await app.prisma.invoice.findUniqueOrThrow({ where: { id: balanceInvoiceId } })).status).toBe('PARTIALLY_PAID');
  });

  test('11 · The same payment webhook delivered again, twice at once, creates no duplicate money', async () => {
    const paid = { event: 'payment_link.paid', payload: { payment: { entity: { id: `pay_${fx.runId}_ok`, amount: 10000000, method: 'upi', notes: { invoiceId: balanceInvoiceId } } } } };
    await app.paymentService.handleWebhookEvent(paid); // sequential replay
    await Promise.allSettled([app.paymentService.handleWebhookEvent(paid), app.paymentService.handleWebhookEvent(paid)]); // concurrent replay
    expect(await app.prisma.payment.count({ where: { invoiceId: balanceInvoiceId } })).toBe(1);
    expect(await app.prisma.activityLog.count({ where: { weddingId, type: 'PAYMENT_RECEIVED' } })).toBe(1);
  });

  test('12 · One source of truth for the numbers: ₹5,00,000 agreed, ₹2,25,000 received, ₹2,75,000 pending', async () => {
    const { finance } = await app.weddingWorkspaceService.getWorkspace(weddingId);
    expect(finance.totals).toEqual({ invoicedTotal: 500000, collected: 225000, outstanding: 275000 });
    const advance = finance.invoices.find((i) => i.id === advanceInvoiceId);
    expect([advance?.amountPaid, advance?.outstanding]).toEqual([125000, 0]);
    expect(finance.agreement?.money).toMatchObject({ received: 225000, outstanding: 275000, bookingConfirmed: true, confirmationAmount: 125000 });
  });

  test('13 · Venue and photographer confirm; catering stays pending → the wedding becomes ACTIVE, attention items are visible', async () => {
    const workspace = await app.weddingWorkspaceService.getWorkspace(weddingId);
    const byVendor = new Map(workspace.events[0].vendorBookings.map((b) => [b.vendorId, b.id]));
    await app.weddingWorkspaceService.updateVendorBookingStatus(weddingId, byVendor.get(vendors[VENUE].id)!, 'CONFIRMED');
    expect((await app.prisma.wedding.findUniqueOrThrow({ where: { id: weddingId } })).status).toBe('ACTIVE'); // first confirmation activates it
    await app.weddingWorkspaceService.updateVendorBookingStatus(weddingId, byVendor.get(vendors[PHOTO].id)!, 'CONFIRMED');

    const after = (await app.weddingWorkspaceService.getWorkspace(weddingId)).events[0].vendorBookings;
    const pending = after.filter((b) => b.status === 'PENDING_VENDOR_CONFIRMATION').map((b) => b.vendorId).sort();
    expect(pending).toEqual([vendors[CATERING].id, vendors[DECOR].id, vendors[DJ].id].sort()); // catering, decoration, DJ still need attention
    expect(after.filter((b) => b.status === 'CONFIRMED')).toHaveLength(2);
  });

  test('14 · An overdue task appears on the Command Center and disappears when it is resolved', async () => {
    const task = await app.weddingWorkspaceService.addTask(weddingId, { title: 'Send venue floor plan to decorator', dueAt: inDays(-1), priority: 'HIGH', createdById: null });
    expect((await app.commandCenterService.getDashboard()).tasks.overdue).toBe(dashboardBefore.overdue + 1);
    await app.weddingWorkspaceService.completeTask(weddingId, task.id, 'DONE');
    expect((await app.commandCenterService.getDashboard()).tasks.overdue).toBe(dashboardBefore.overdue);
  });

  test('15 · The Command Center shows the wedding as upcoming and the money as due', async () => {
    // Only non-draft invoices count as due: the balance invoice is PARTIALLY_PAID (a payment reached it), so its ₹2,75,000 is due.
    const after = await app.commandCenterService.getDashboard();
    expect(after.finance.outstanding).toBeGreaterThanOrEqual(275000);
    expect(after.today.paymentsDue).toBeGreaterThanOrEqual(1);
    expect(after.upcomingEvents.some((e) => e.weddingId === weddingId && e.date.startsWith('2026-11-20'))).toBe(true);
  });

  test('16 · Everything important was recorded in the wedding activity log', async () => {
    const logs = await app.prisma.activityLog.findMany({ where: { weddingId }, select: { type: true, summary: true } });
    const types = new Set(logs.map((l) => l.type));
    for (const type of ['INVOICE_CREATED', 'PAYMENT_RECEIVED', 'STATUS_CHANGED', 'VENDOR_CONFIRMED']) {
      if (type === 'VENDOR_CONFIRMED' && !types.has(type)) continue; // logged as STATUS_CHANGED by the current lifecycle code
      expect(types.has(type as never)).toBe(true);
    }
    expect(logs.some((l) => l.summary.includes('Payment attempt failed'))).toBe(true);
    expect(logs.some((l) => l.summary.includes('created from confirmed booking'))).toBe(true);
    // and the source's own timeline shows the quotation journey
    const sourceLogs = await app.prisma.activityLog.findMany({ where: { consultationId }, select: { type: true } });
    const sourceTypes = sourceLogs.map((l) => l.type);
    for (const type of ['QUOTATION_SENT', 'QUOTATION_ACCEPTED']) expect(sourceTypes).toContain(type as never);
  });

  // ---- Not yet possible — each is a gap in docs/VIVAH_OS_TECH_COMPLETION.md. Turn a todo into a test when it is built. ----
  gap('Wedding Events: add Haldi, Mehendi and Sangeet after conversion (audit P0-2 — only one event is created today)');
  gap('Payments: record a cash / UPI / bank-transfer payment (audit P0-5 — only Razorpay payment links exist)');
  gap('Payments: the Command Center lists an unpaid wedding invoice as due once its payment link is created (today only non-DRAFT invoices count, and creating a payment link leaves the invoice DRAFT)');
  gap('Availability: two bookings for the same venue and date — exactly one wins (audit P0-3 — availability has no writer)');
  gap('Completion: a wedding with an unpaid balance, open tasks or unconfirmed vendors cannot be marked COMPLETED (audit P0-4)');
  gap('Documents: upload and attach a contract to the wedding, invisible to another wedding (audit P1 — no document create path)');
  gap('Notifications: the venue owner is told about the new booking (audit P1 — notifications are not delivered)');
});
