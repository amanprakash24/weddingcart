/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, inDays, loadApp, tally, type App } from './helpers/app';
import { createFixtures, PLANTED_INVOICE_CLIENT, type Fixtures } from './helpers/fixtures';

// Races that only a real database can prove (docs/VIVAH_OS_TECH_COMPLETION.md §12 edge cases): "two users doing the same
// thing at the same moment" must produce exactly one winner and never corrupt state. Nothing is mocked — the advisory locks,
// unique indexes and transactions are the real ones.

dbDescribe('quotation & conversion concurrency (real database)', () => {
  let app: App;
  let fx: Fixtures;

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
  });
  afterAll(async () => {
    if (fx) await fx.purge();
  });

  const three = <T>(make: () => Promise<T>) => Promise.allSettled([make(), make(), make()]);

  test('3 people creating a quote for the same source at once → exactly one succeeds, the rest get a clean 409', async () => {
    const c = await fx.consultation();
    const result = tally(await three(() => app.quotationService.create('CONSULTATION', c.id, { items: [fx.line('Venue', 100000)] }, null)));
    expect(result).toEqual({ ok: 1, conflicts: 2, other: [] });
    expect(await app.prisma.quotation.count({ where: { consultationId: c.id } })).toBe(1);
  });

  test('3 simultaneous sends of one draft → exactly one, logged once', async () => {
    const c = await fx.consultation();
    const draft = await app.quotationService.create('CONSULTATION', c.id, { items: [fx.line('Venue', 100000)], validUntil: inDays(5) }, null);
    const result = tally(await three(() => app.quotationService.send(draft.id, null)));
    expect(result).toEqual({ ok: 1, conflicts: 2, other: [] });
    expect(await app.prisma.activityLog.count({ where: { consultationId: c.id, type: 'QUOTATION_SENT' } })).toBe(1);
  });

  test('3 simultaneous acceptances → exactly one, recorded once', async () => {
    const c = await fx.consultation();
    const sent = await fx.sentQuote(c.id);
    const result = tally(await three(() => app.quotationService.accept(sent.id, { channel: 'PHONE' }, null)));
    expect(result).toEqual({ ok: 1, conflicts: 2, other: [] });
    const stored = await app.quotationService.getById(sent.id);
    expect(stored.status).toBe('ACCEPTED');
    expect(await app.prisma.activityLog.count({ where: { consultationId: c.id, type: 'QUOTATION_ACCEPTED' } })).toBe(1);
  });

  test('3 simultaneous revisions of one quote → exactly one revision draft exists', async () => {
    const c = await fx.consultation();
    const sent = await fx.sentQuote(c.id);
    const result = tally(await three(() => app.quotationService.revise(sent.id, null)));
    expect(result).toEqual({ ok: 1, conflicts: 2, other: [] });
    const quotes = await app.quotationService.listForSource('CONSULTATION', c.id);
    expect(quotes.filter((q) => q.status === 'DRAFT')).toHaveLength(1);
    expect(quotes.filter((q) => q.status === 'SENT')).toHaveLength(0); // the original is superseded, never two open at once
  });

  test('3 simultaneous "create booking" for one accepted quote → exactly one booking', async () => {
    const c = await fx.consultation();
    const accepted = await fx.acceptedQuote(c.id);
    const result = tally(await three(() => app.quotationService.createBooking(accepted.id, {}, null)));
    expect(result).toEqual({ ok: 1, conflicts: 2, other: [] });
    expect(await app.prisma.booking.count({ where: { quotationId: accepted.id } })).toBe(1);
  });

  test('8 simultaneous invoice creations all get distinct numbers (the old count-based scheme collided here)', async () => {
    const made = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        app.prisma.$transaction(async (tx) =>
          tx.invoice.create({
            data: { invoiceNumber: await app.generateInvoiceNumber(tx), clientName: PLANTED_INVOICE_CLIENT, clientPhone: '9000000000', subtotal: 1, total: 1 },
          })
        )
      )
    );
    const numbers = made.flatMap((r) => (r.status === 'fulfilled' ? [r.value.invoiceNumber] : []));
    expect(made.filter((r) => r.status === 'rejected').map((r) => (r as PromiseRejectedResult).reason?.message)).toEqual([]);
    expect(new Set(numbers).size).toBe(8);
  });

  test('deleting an invoice never causes a duplicate number: the next number is highest + 1', async () => {
    const created = [];
    for (let i = 0; i < 3; i += 1) {
      created.push(
        await app.prisma.$transaction(async (tx) =>
          tx.invoice.create({
            data: { invoiceNumber: await app.generateInvoiceNumber(tx), clientName: PLANTED_INVOICE_CLIENT, clientPhone: '9000000000', subtotal: 1, total: 1 },
          })
        )
      );
    }
    const sorted = created.map((i) => i.invoiceNumber).sort();
    await app.prisma.invoice.delete({ where: { id: created.find((i) => i.invoiceNumber === sorted[1])!.id } }); // delete the MIDDLE one
    const next = await app.prisma.$transaction(async (tx) => app.generateInvoiceNumber(tx));
    const existing = new Set((await app.prisma.invoice.findMany({ select: { invoiceNumber: true } })).map((i) => i.invoiceNumber));
    expect(existing.has(next)).toBe(false);
    expect(next > sorted[2]).toBe(true);
  });

  test('two DIFFERENT weddings converting at the same moment both succeed, each with its own numbers and advance invoice', async () => {
    const [v] = await fx.vendors(1);
    const a = await fx.confirmedBooking((await fx.consultation()).id, { advance: 100000, items: [fx.line('Venue', 300000, 1, v.id)] });
    const b = await fx.confirmedBooking((await fx.consultation()).id, { advance: 150000, items: [fx.line('Venue', 300000, 1, v.id)] });

    const results = await Promise.allSettled([app.convertBookingToWedding(a.booking.id), app.convertBookingToWedding(b.booking.id)]);
    expect(results.filter((r) => r.status === 'rejected').map((r) => (r as PromiseRejectedResult).reason?.message)).toEqual([]);

    const weddings = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    expect(new Set(weddings.map((w) => w.weddingNumber)).size).toBe(2);
    const invoices = await app.prisma.invoice.findMany({ where: { weddingId: { in: weddings.map((w) => w.id) } }, select: { invoiceNumber: true, total: true } });
    expect(invoices).toHaveLength(2);
    expect(new Set(invoices.map((i) => i.invoiceNumber)).size).toBe(2);
    expect(invoices.map((i) => i.total).sort((x, y) => x - y)).toEqual([75000, 75000]); // Money V1: 25% of ₹3,00,000 each — not the typed ₹1,00,000 / ₹1,50,000 advances
  });

  test('a double-clicked "confirm" (the same booking converted twice at once) → one wedding, one invoice, both calls return it', async () => {
    const { booking } = await fx.confirmedBooking((await fx.consultation()).id, { advance: 80000 });
    const results = await Promise.allSettled([app.convertBookingToWedding(booking.id), app.convertBookingToWedding(booking.id), app.convertBookingToWedding(booking.id)]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const ids = new Set(results.flatMap((r) => (r.status === 'fulfilled' ? [r.value.id] : [])));
    expect(ids.size).toBe(1);
    expect(await app.prisma.wedding.count({ where: { sourceBookingId: booking.id } })).toBe(1);
    expect(await app.prisma.invoice.count({ where: { weddingId: [...ids][0] } })).toBe(1);
  });

  test('if the booking\'s invoice cannot be created, the WHOLE booking creation rolls back — then the same call succeeds once fixed (Money V1: the invoice is made with the booking)', async () => {
    // Plant two invoices so the number generator (which finds the highest by text order) proposes one that already exists.
    const bucket = app.monthBucket('INV');
    const planted = await Promise.all(
      [`${bucket}9999`, `${bucket}10000`].map((invoiceNumber) =>
        app.prisma.invoice.create({ data: { invoiceNumber, clientName: PLANTED_INVOICE_CLIENT, clientPhone: '9000000000', subtotal: 1, total: 1 } })
      )
    );
    const quotation = await fx.acceptedQuote((await fx.consultation()).id, { advance: 60000 });

    const failure = await app.quotationService.createBooking(quotation.id, {}, null).then(() => null, (e: Error) => e);
    expect(failure?.name).toBe('DuplicateError'); // the planted numbers collide, so the booking's invoice cannot be created
    expect(await app.prisma.booking.count({ where: { quotationId: quotation.id } })).toBe(0); // no booking without its invoice
    expect(await app.prisma.commercialAgreement.count({ where: { quotationId: quotation.id } })).toBe(0); // no agreement without its invoice
    expect((await app.quotationService.getById(quotation.id)).advanceInvoiceId).toBeNull(); // nothing half-linked

    await app.prisma.invoice.deleteMany({ where: { id: { in: planted.map((p) => p.id) } } });
    const booking = await app.quotationService.createBooking(quotation.id, {}, null); // retry-safe: no manual repair needed
    expect(await app.prisma.invoice.count({ where: { quotationId: quotation.id } })).toBe(1);
    await fx.payConfirmation(quotation.id);
    await app.bookingService.update(booking.id, { status: 'CONFIRMED' });
    const retry = await app.convertBookingToWedding(booking.id);
    expect(await app.prisma.invoice.count({ where: { weddingId: retry.id } })).toBe(1);
  });
});
