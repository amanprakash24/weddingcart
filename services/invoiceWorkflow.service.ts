import type { Prisma, Wedding } from '@/generated/prisma/client';
import { ActivityType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { balanceOf, checkBalanceInvoice, checkManualPayment, deriveInvoiceStatus, planBalanceInvoice, type ManualPaymentMethod } from '@/lib/invoice/lifecycle';
import { activityLogRepository } from '@/repositories/activityLog.repository';
import { invoiceRepository } from '@/repositories/invoice.repository';
import { generateInvoiceNumber } from '@/services/documentNumber.service';

type Tx = Prisma.TransactionClient;

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const METHOD_LABEL: Record<ManualPaymentMethod, string> = { CASH: 'cash', UPI: 'UPI', BANK_TRANSFER: 'bank transfer', CHEQUE: 'cheque' };

async function loadWeddingInvoice(tx: Tx, weddingId: string, invoiceId: string) {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!invoice || invoice.weddingId !== weddingId) throw new NotFoundError('Invoice', invoiceId);
  return invoice;
}

const paidOf = (invoice: { payments: { status: string; amount: number }[] }) =>
  invoice.payments.filter((p) => p.status === 'SUCCESS').reduce((sum, p) => sum + p.amount, 0);

// The agreement a wedding was booked on: the ACCEPTED quotation it came from. Booking path → the booking's own quotation;
// CRM path (no booking) → the source's accepted quotation. Anything else is "no agreement" — never a guess, never an older version.
export async function findAgreementForWedding(tx: Tx, wedding: Wedding) {
  if (wedding.sourceBookingId) {
    const booking = await tx.booking.findUnique({ where: { id: wedding.sourceBookingId }, include: { quotation: { include: { items: true } } } });
    return booking?.quotation ? { quotation: booking.quotation, booking } : null;
  }
  const source = wedding.sourceLeadId
    ? { leadId: wedding.sourceLeadId }
    : wedding.sourceEnquiryId
      ? { enquiryId: wedding.sourceEnquiryId }
      : wedding.sourceConsultationId
        ? { consultationId: wedding.sourceConsultationId }
        : null;
  if (!source) return null;
  const quotation = await tx.quotation.findFirst({ where: { ...source, status: 'ACCEPTED' }, include: { items: true } });
  if (!quotation) return null;
  // On this path the wedding's booking, if one was made later, is not the source; a booking made from the quotation still counts.
  const booking = await tx.booking.findFirst({ where: { quotationId: quotation.id } });
  return { quotation, booking };
}

// The ONE place an invoice's status is worked out and written. It locks the invoice row first and reads the payments FROM THE DATABASE,
// so two things happening at once (issuing while a payment is recorded, a webhook while someone records cash) can never overwrite each
// other with a stale status: whoever gets the lock second sees what the first one did. Found in the browser test — an issue that was
// still in flight overwrote a payment recorded a moment earlier, leaving a part-paid invoice showing "Sent".
export async function settleInvoiceStatus(tx: Tx, invoiceId: string, opts: { issue?: boolean } = {}) {
  await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${invoiceId} FOR UPDATE`;
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!invoice) throw new NotFoundError('Invoice', invoiceId);
  const paid = paidOf(invoice);
  const status = deriveInvoiceStatus({ current: invoice.status, total: invoice.total, paid, issued: Boolean(opts.issue) || invoice.issuedAt !== null });
  const issuedAt = invoice.issuedAt ?? (status !== 'DRAFT' ? new Date() : null);
  if (status !== invoice.status || issuedAt?.getTime() !== invoice.issuedAt?.getTime()) {
    await invoiceRepository.update(invoiceId, { status, issuedAt }, tx);
  }
  return { status, paid, balance: balanceOf(invoice.total, paid), invoice };
}

export const invoiceWorkflowService = {
  // DRAFT → SENT. Issuing is what makes an invoice "sent" — creating a payment link does it too (payment.service.ts).
  async issueInvoice(weddingId: string, invoiceId: string, actorId: string | null) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${invoiceId} FOR UPDATE`; // whoever arrives second sees the first one's result
      const invoice = await loadWeddingInvoice(tx, weddingId, invoiceId);
      if (invoice.status !== 'DRAFT') throw new ConflictError(`Invoice ${invoice.invoiceNumber} has already been issued`);
      const updated = await invoiceRepository.update(invoiceId, { status: 'SENT', issuedAt: new Date() }, tx);
      await activityLogRepository.create(
        {
          type: ActivityType.STATUS_CHANGED,
          summary: `Invoice ${invoice.invoiceNumber} issued (${rupees(invoice.total)})`,
          wedding: { connect: { id: weddingId } },
          performedBy: actorId ? { connect: { id: actorId } } : undefined,
        },
        tx
      );
      return updated;
    });
  },

  // The second invoice of an accepted agreement: total − advance, from the ACCEPTED quotation only.
  async createBalanceInvoice(weddingId: string, actorId: string | null) {
    return prisma.$transaction(async (tx) => {
      const wedding = await tx.wedding.findUnique({ where: { id: weddingId } });
      if (!wedding) throw new NotFoundError('Wedding', weddingId);
      const agreement = await findAgreementForWedding(tx, wedding);
      const existing = agreement ? await tx.invoice.findFirst({ where: { quotationId: agreement.quotation.id, kind: 'BALANCE' }, select: { id: true } }) : null;
      const blocked = checkBalanceInvoice({ quotation: agreement?.quotation ?? null, alreadyHasBalanceInvoice: existing !== null });
      if (blocked || !agreement) throw new ConflictError(blocked ?? 'This wedding has no accepted quotation to invoice from');

      // Who to bill: the same person the advance invoice went to, else the booking, else the source record.
      const prior = await tx.invoice.findFirst({ where: { weddingId }, orderBy: { createdAt: 'asc' } });
      let client: { name: string; phone: string; email?: string | null; city?: string | null } | null = prior
        ? { name: prior.clientName, phone: prior.clientPhone, email: prior.clientEmail, city: prior.clientCity }
        : agreement.booking
          ? { name: agreement.booking.name, phone: agreement.booking.phone, city: agreement.booking.city }
          : null;
      if (!client) {
        const select = { name: true, phone: true, city: true } as const;
        const subject = wedding.sourceLeadId
          ? await tx.lead.findUnique({ where: { id: wedding.sourceLeadId }, select })
          : wedding.sourceEnquiryId
            ? await tx.enquiry.findUnique({ where: { id: wedding.sourceEnquiryId }, select })
            : wedding.sourceConsultationId
              ? await tx.consultation.findUnique({ where: { id: wedding.sourceConsultationId }, select })
              : null;
        client = subject ? { name: subject.name, phone: subject.phone, city: subject.city } : null;
      }
      if (!client) throw new ValidationError('There are no customer details to bill');

      const plan = planBalanceInvoice({ quotation: agreement.quotation, wedding, client });
      const invoice = await invoiceRepository.create(
        {
          invoiceNumber: await generateInvoiceNumber(tx),
          ...plan.invoice,
          status: 'DRAFT',
          kind: 'BALANCE',
          quotation: { connect: { id: agreement.quotation.id } },
          booking: agreement.booking ? { connect: { id: agreement.booking.id } } : undefined,
          customerId: wedding.customerId ?? undefined,
          wedding: { connect: { id: weddingId } },
          items: { create: plan.items },
        },
        tx
      );
      await activityLogRepository.create(
        {
          type: ActivityType.INVOICE_CREATED,
          summary: `Balance invoice ${invoice.invoiceNumber} created from quotation ${agreement.quotation.quotationNumber} — ${rupees(invoice.total)} (draft)`,
          wedding: { connect: { id: weddingId } },
          performedBy: actorId ? { connect: { id: actorId } } : undefined,
        },
        tx
      );
      return invoice;
    });
  },

  // Cash / UPI / bank transfer / cheque received outside Razorpay. Recorded against an invoice of THIS wedding, never more than
  // the balance, and the invoice's status follows (PARTIALLY_PAID, then PAID).
  async recordManualPayment(
    weddingId: string,
    invoiceId: string,
    input: { amount: number; method: ManualPaymentMethod; reference?: string | null; paidAt?: Date | null },
    actorId: string | null
  ) {
    return prisma.$transaction(async (tx) => {
      // Two people recording at once must not both fit under the balance: serialise on the invoice row.
      await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${invoiceId} FOR UPDATE`;
      const invoice = await loadWeddingInvoice(tx, weddingId, invoiceId);
      const paid = paidOf(invoice);
      const blocked = checkManualPayment({ amount: input.amount, total: invoice.total, paid, method: input.method });
      if (blocked) throw new ValidationError(blocked);

      const payment = await tx.payment.create({
        data: { invoiceId, amount: input.amount, method: input.method, status: 'SUCCESS', paidAt: input.paidAt ?? new Date() },
      });
      const { status, paid: newPaid } = await settleInvoiceStatus(tx, invoiceId, { issue: true });
      const reference = input.reference?.trim();
      await activityLogRepository.create(
        {
          type: ActivityType.PAYMENT_RECEIVED,
          summary: `Payment recorded: ${rupees(input.amount)} by ${METHOD_LABEL[input.method]} on ${invoice.invoiceNumber}${reference ? ` (ref ${reference})` : ''} — balance ${rupees(balanceOf(invoice.total, newPaid))}`,
          wedding: { connect: { id: weddingId } },
          performedBy: actorId ? { connect: { id: actorId } } : undefined,
        },
        tx
      );
      return { payment, status, balance: balanceOf(invoice.total, newPaid) };
    });
  },
};

// ---------- the old, standalone Invoices screen ----------

const last10 = (phone: string) => phone.replace(/D/g, '').slice(-10);

// Open weddings (not cancelled) belonging to the customer with this phone number, found through the booking or the lead /
// enquiry / consultation the wedding came from.
export async function findWeddingsForClientPhone(phone: string): Promise<{ id: string; weddingNumber: string }[]> {
  const digits = last10(phone);
  if (digits.length < 10) return [];
  const match = { phone: { endsWith: digits } };
  const [bookings, leads, enquiries, consultations] = await Promise.all([
    prisma.booking.findMany({ where: match, select: { id: true } }),
    prisma.lead.findMany({ where: match, select: { id: true } }),
    prisma.enquiry.findMany({ where: match, select: { id: true } }),
    prisma.consultation.findMany({ where: match, select: { id: true } }),
  ]);
  const or: Prisma.WeddingWhereInput[] = [
    ...(bookings.length ? [{ sourceBookingId: { in: bookings.map((b) => b.id) } }] : []),
    ...(leads.length ? [{ sourceLeadId: { in: leads.map((b) => b.id) } }] : []),
    ...(enquiries.length ? [{ sourceEnquiryId: { in: enquiries.map((b) => b.id) } }] : []),
    ...(consultations.length ? [{ sourceConsultationId: { in: consultations.map((b) => b.id) } }] : []),
  ];
  if (or.length === 0) return [];
  return prisma.wedding.findMany({ where: { OR: or, status: { not: 'CANCELLED' } }, select: { id: true, weddingNumber: true }, orderBy: { createdAt: 'desc' } });
}

export function standaloneInvoiceWarning(weddings: { weddingNumber: string }[]): string {
  const names = weddings.map((w) => w.weddingNumber).join(', ');
  return `This customer already has a wedding (${names}). Invoices for a wedding are created and managed inside that wedding, under Money.`;
}
