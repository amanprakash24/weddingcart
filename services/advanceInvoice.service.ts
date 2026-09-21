import type { Prisma } from '@/generated/prisma/client';
import { ActivityType } from '@/generated/prisma/enums';
import { decideAdvanceInvoice, planAdvanceInvoice, type AdvanceInvoiceClient } from '@/lib/quotation/advanceInvoice';
import { activityLogRepository } from '@/repositories/activityLog.repository';
import { invoiceRepository } from '@/repositories/invoice.repository';
import { quotationRepository, type QuotationWithItems } from '@/repositories/quotation.repository';
import { generateInvoiceNumber } from '@/services/documentNumber.service';

type Tx = Prisma.TransactionClient;

// Creates the advance Invoice for an ACCEPTED quotation, INSIDE the caller's conversion transaction
// (docs/wedding-os/08-quotation.md §6.6). Called by both conversion paths — booking → wedding and
// CRM lead → wedding — after the Wedding exists.
//
// Idempotent: Quotation.advanceInvoiceId is @unique, so a retried or racing conversion cannot create a
// second invoice (the conversion's own advisory lock already serializes them; the constraint is the backstop).
// If anything here throws, the WHOLE conversion rolls back — a wedding never appears without the invoice its
// accepted quotation promised. It never calls Razorpay: the payment link is created afterwards, by staff,
// outside any transaction.
export async function ensureAdvanceInvoice(
  tx: Tx,
  input: {
    wedding: { id: string; primaryDate: Date; weddingType: string | null; customerId: string | null };
    quotation: QuotationWithItems | null;
    client: AdvanceInvoiceClient;
    // The booking this wedding came from (booking path); null on the CRM path, which has no Booking.
    bookingId?: string | null;
    actorId: string | null;
  }
): Promise<{ invoiceId: string; invoiceNumber: string } | null> {
  const { wedding, quotation, client, actorId, bookingId } = input;
  if (decideAdvanceInvoice(quotation).action !== 'CREATE' || !quotation) return null;

  const plan = planAdvanceInvoice({ quotation, wedding, client });
  const invoice = await invoiceRepository.create(
    {
      invoiceNumber: await generateInvoiceNumber(tx),
      ...plan.invoice,
      status: 'DRAFT',
      // The invoice belongs to the accepted agreement it came from: its quotation and, on the booking path, its booking.
      kind: 'ADVANCE',
      quotation: { connect: { id: quotation.id } },
      booking: bookingId ? { connect: { id: bookingId } } : undefined,
      customerId: wedding.customerId ?? undefined,
      wedding: { connect: { id: wedding.id } },
      items: { create: plan.items },
    },
    tx
  );

  await quotationRepository.update(quotation.id, { advanceInvoice: { connect: { id: invoice.id } } }, tx);

  await activityLogRepository.create(
    {
      type: ActivityType.INVOICE_CREATED,
      summary: `Advance invoice ${invoice.invoiceNumber} created automatically from quotation ${quotation.quotationNumber} — ₹${quotation.advanceAmount.toLocaleString('en-IN')} (draft; create the payment link from Finance)`,
      wedding: { connect: { id: wedding.id } },
      performedBy: actorId ? { connect: { id: actorId } } : undefined,
    },
    tx
  );

  return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
}
