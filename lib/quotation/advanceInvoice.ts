// The automatic advance invoice (docs/wedding-os/08-quotation.md §6.6, founding-team decision of
// 20 Sep 2026): when a booking or lead converts to a Wedding, the accepted quotation's advance becomes a
// DRAFT Invoice inside the same transaction.
//
// Pure — the service that runs it inside the conversion transaction is services/advanceInvoice.service.ts.
//
// Tax (decision Q4, extended 7 Oct 2026): the invoice has no tax line unless its quotation charges GST AND carries the seller's
// frozen GST number — then it carries its share of that GST (lib/invoice/gstShare.ts). Nothing about GST is invented here: a
// quotation without a GST number (every Shaadi Shopping quotation today) gives the invoice it always gave. The Razorpay payment link is
// deliberately NOT created here — it is an external call that must never run inside a database
// transaction — so staff create it afterwards from the wedding's Finance panel, as they do today.
import type { QuotationStatus } from '@/generated/prisma/enums';
import { advanceInvoiceGst } from '@/lib/invoice/gstShare';

export type AdvanceInvoiceDecision =
  | { action: 'CREATE' }
  | { action: 'SKIP'; reason: 'NO_QUOTATION' | 'NOT_ACCEPTED' | 'NO_ADVANCE' | 'ALREADY_CREATED' };

// One invoice per quotation, ever: an existing advanceInvoiceId means a previous (or retried, or racing)
// conversion already made it. Zero advance means nothing to invoice.
export function decideAdvanceInvoice(
  quotation: { status: QuotationStatus; advanceAmount: number; advanceInvoiceId: string | null } | null | undefined
): AdvanceInvoiceDecision {
  if (!quotation) return { action: 'SKIP', reason: 'NO_QUOTATION' };
  if (quotation.status !== 'ACCEPTED') return { action: 'SKIP', reason: 'NOT_ACCEPTED' };
  if (quotation.advanceInvoiceId) return { action: 'SKIP', reason: 'ALREADY_CREATED' };
  if (quotation.advanceAmount <= 0) return { action: 'SKIP', reason: 'NO_ADVANCE' };
  return { action: 'CREATE' };
}

export interface AdvanceInvoiceClient {
  name: string;
  phone: string;
  email?: string | null;
  city?: string | null;
}

export interface AdvanceInvoicePlan {
  invoice: {
    clientName: string;
    clientPhone: string;
    clientEmail: string | null;
    clientCity: string | null;
    eventDate: string | null; // YYYY-MM-DD; null when the wedding date is not known yet (a CRM quotation before its wedding exists)
    eventType: string | null;
    subtotal: number;
    discount: number;
    gstEnabled: boolean;
    gstAmount: number;
    sellerGstin: string | null;
    total: number;
    notes: string;
  };
  items: { description: string; amount: number; quantity: 1 }[];
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function planAdvanceInvoice(input: {
  quotation: { quotationNumber: string; total: number; advanceAmount: number; gstAmount?: number | null; sellerGstin?: string | null };
  wedding: { primaryDate: Date | null; weddingType: string | null };
  client: AdvanceInvoiceClient;
  // Money v1: the booking-confirmation amount the agreement froze (25% of the accepted total). When given, it is what the invoice is
  // for — the quotation's own free-form advance no longer decides it. Absent = the historical behaviour (quotation.advanceAmount).
  confirmationAmount?: number;
}): AdvanceInvoicePlan {
  const { quotation, wedding, client } = input;
  const amount = input.confirmationAmount ?? quotation.advanceAmount;
  const tax = advanceInvoiceGst(amount, quotation);
  const taxNote = tax.gst > 0 ? `Includes GST ${inr(tax.gst)} (GSTIN ${tax.sellerGstin}).` : 'No tax applied.';
  return {
    invoice: {
      clientName: client.name,
      clientPhone: client.phone,
      clientEmail: client.email?.trim() || null,
      clientCity: client.city?.trim() || null,
      eventDate: wedding.primaryDate ? wedding.primaryDate.toISOString().slice(0, 10) : null,
      eventType: wedding.weddingType,
      subtotal: tax.taxable,
      discount: 0,
      gstEnabled: tax.gst > 0,
      gstAmount: tax.gst,
      sellerGstin: tax.sellerGstin,
      total: amount,
      notes:
        input.confirmationAmount !== undefined
          ? `Booking confirmation amount against quotation ${quotation.quotationNumber} (quotation total ${inr(quotation.total)}). ${taxNote}`
          : `Advance against quotation ${quotation.quotationNumber} (quotation total ${inr(quotation.total)}). ${taxNote}`,
    },
    items: [{ description: `Advance — ${quotation.quotationNumber}`, amount, quantity: 1 }],
  };
}
