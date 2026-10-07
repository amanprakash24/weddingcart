// GST on the invoices made from a quotation (founder, 7 Oct 2026). Pure and client-safe.
//
// A quotation's total already has its GST inside it (lib/quotation/lineGst.ts), and its invoices each bill a PART of that total:
// the amount that confirms the booking, then the balance. So each invoice carries its part of the GST, in the same proportion:
//
//   GST on the first invoice = its amount × the quotation's GST ÷ the quotation's total, to the nearest rupee
//   GST on the balance       = the quotation's GST − what the first invoice carried        (so the two add up exactly)
//   taxable value            = the invoice's amount − its GST
//
// It applies only to a quotation that carries the seller's frozen GST number (Quotation.sellerGstin) — a document that shows GST
// must show whose GST it is. Without one the invoice is exactly what it was before: no tax line.
//
// This is a business rule pending the CA's confirmation, like the discount-before-GST rule — it is not a statement of tax law.

export interface GstSource {
  total: number;
  gstAmount?: number | null;
  sellerGstin?: string | null;
}

export interface InvoiceGst {
  taxable: number;
  gst: number;
  sellerGstin: string | null;
}

const chargesGst = (q: GstSource) => Boolean(q.sellerGstin) && (q.gstAmount ?? 0) > 0 && q.total > 0;

const shareOf = (amount: number, q: GstSource) => Math.min(q.gstAmount ?? 0, Math.round((amount * (q.gstAmount ?? 0)) / q.total));

// The first invoice of the agreement (the amount that confirms the booking).
export function advanceInvoiceGst(amount: number, q: GstSource): InvoiceGst {
  if (!chargesGst(q)) return { taxable: amount, gst: 0, sellerGstin: null };
  const gst = Math.min(amount, shareOf(amount, q));
  return { taxable: amount - gst, gst, sellerGstin: q.sellerGstin ?? null };
}

// The balance invoice: whatever GST the first invoice did not carry.
export function balanceInvoiceGst(balance: number, advance: number, q: GstSource): InvoiceGst {
  if (!chargesGst(q)) return { taxable: balance, gst: 0, sellerGstin: null };
  const gst = Math.min(balance, Math.max(0, (q.gstAmount ?? 0) - advanceInvoiceGst(advance, q).gst));
  return { taxable: balance - gst, gst, sellerGstin: q.sellerGstin ?? null };
}
