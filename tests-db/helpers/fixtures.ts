// Deterministic, self-cleaning fixtures for the real-database tests.
//
// Every row a test creates hangs off a Consultation carrying MARKER in its message, so purge() can find and remove
// EVERYTHING a run made — including leftovers from a run that crashed halfway. Tests never borrow or change the
// existing staging data (apart from reading a few vendors), so they are repeatable and leave the database as found.
import { randomUUID } from 'node:crypto';
import { inDays, type App } from './app';

export const MARKER = '[[dbtest]]';
export const PLANTED_INVOICE_CLIENT = 'DBTEST planted';

type ConsultationOverrides = Partial<{ name: string; phone: string; city: string | null; weddingDate: string; guestCount: number; totalBudget: number }>;

export function createFixtures(app: App) {
  const { prisma, quotationService, bookingService } = app;
  const runId = randomUUID().slice(0, 8);
  let counter = 0;

  async function consultation(overrides: ConsultationOverrides = {}) {
    counter += 1;
    return prisma.consultation.create({
      data: {
        name: overrides.name ?? `DBTEST ${runId} #${counter}`,
        phone: overrides.phone ?? '9000000000',
        city: overrides.city === undefined ? 'Patna' : overrides.city,
        weddingDate: overrides.weddingDate ?? '2026-12-05',
        days: 1,
        guestCount: overrides.guestCount ?? 500,
        totalBudget: overrides.totalBudget,
        message: `${MARKER} ${runId}`,
      },
    });
  }

  // A few real vendors, read-only, in a stable order (their bookings are deleted with the test wedding).
  async function vendors(count: number) {
    const rows = await prisma.vendor.findMany({ orderBy: { slug: 'asc' }, take: count, select: { id: true, name: true } });
    if (rows.length < count) throw new Error(`the test database needs at least ${count} vendors`);
    return rows;
  }

  const line = (description: string, unitPrice: number, quantity = 1, vendorId?: string, category?: string) => ({
    description,
    unitPrice,
    quantity,
    vendorId,
    category,
  });

  async function sentQuote(consultationId: string, input: { items?: ReturnType<typeof line>[]; advance?: number; discount?: number } = {}) {
    const [vendor] = await vendors(1);
    const draft = await quotationService.create(
      'CONSULTATION',
      consultationId,
      {
        items: input.items ?? [line('Venue hire', 300000, 1, vendor.id)],
        advanceAmount: input.advance ?? 100000,
        discount: input.discount,
        validUntil: inDays(10),
      },
      null
    );
    await quotationService.send(draft.id, null);
    return draft;
  }

  async function acceptedQuote(consultationId: string, input: Parameters<typeof sentQuote>[1] = {}) {
    const sent = await sentQuote(consultationId, input);
    return quotationService.accept(sent.id, { channel: 'WHATSAPP', note: 'db test' }, null);
  }

  // accepted quote → booking → CONFIRMED (not yet converted: the caller decides when to convert).
  async function confirmedBooking(consultationId: string, input: Parameters<typeof sentQuote>[1] = {}) {
    const quotation = await acceptedQuote(consultationId, input);
    const booking = await quotationService.createBooking(quotation.id, {}, null);
    await bookingService.update(booking.id, { status: 'CONFIRMED' });
    return { quotation, booking };
  }

  // Removes everything any run (this one or a crashed earlier one) created.
  async function purge() {
    const ids = (await prisma.consultation.findMany({ where: { message: { startsWith: MARKER } }, select: { id: true } })).map((c) => c.id);
    const bookingIds = (await prisma.booking.findMany({ where: { consultationId: { in: ids } }, select: { id: true } })).map((b) => b.id);
    const weddingIds = (
      await prisma.wedding.findMany({
        where: { OR: [{ sourceConsultationId: { in: ids } }, { sourceBookingId: { in: bookingIds } }] },
        select: { id: true },
      })
    ).map((w) => w.id);
    const advanceIds = (await prisma.quotation.findMany({ where: { consultationId: { in: ids } }, select: { advanceInvoiceId: true } }))
      .map((q) => q.advanceInvoiceId)
      .filter((x): x is string => !!x);

    // Invoices first (Invoice.wedding is SetNull — deleting a wedding first would orphan them). Payments and payment
    // links cascade with their invoice.
    await prisma.invoice.deleteMany({
      where: { OR: [{ clientName: PLANTED_INVOICE_CLIENT }, { weddingId: { in: weddingIds } }, { id: { in: advanceIds } }] },
    });
    for (const id of weddingIds) await prisma.wedding.delete({ where: { id } }); // cascades events, vendor bookings, tasks, milestones, logs
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    await prisma.quotation.deleteMany({ where: { consultationId: { in: ids } } });
    await prisma.activityLog.deleteMany({ where: { consultationId: { in: ids } } });
    await prisma.task.deleteMany({ where: { consultationId: { in: ids } } });
    await prisma.consultation.deleteMany({ where: { id: { in: ids } } });
  }

  return { runId, consultation, vendors, line, sentQuote, acceptedQuote, confirmedBooking, purge };
}

export type Fixtures = ReturnType<typeof createFixtures>;
