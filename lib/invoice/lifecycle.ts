// The invoice lifecycle, and the balance-invoice plan. Pure and free of server imports.
//
//   DRAFT ──issue / payment link──▶ SENT ──part payment──▶ PARTIALLY_PAID ──rest──▶ PAID
//
// Status is never guessed: it is DERIVED from what actually happened — was it issued, and how much has been received. That is
// what fixes the invoice that stayed DRAFT forever after its payment link went out.
//
// Money design v1, PR 7: a credit note lowers what is owed (outstanding = total − paid − credited) and an invoice the couple never
// paid can be cancelled (voided) — then it counts for nothing. Neither edits the invoice's own figures.
import { balanceInvoiceGst } from './gstShare';

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID';

// The status an invoice should have, given whether it has been issued and how much has been received.
// - money received always means it was issued;
// - never moves backwards from what has already happened.
// - a credit note counts towards settling it (credited); a fully settled invoice is PAID.
export function deriveInvoiceStatus(input: { current: InvoiceStatus; total: number; paid: number; issued: boolean; credited?: number }): InvoiceStatus {
  const { current, total, paid, issued } = input;
  const credited = input.credited ?? 0;
  if (current === 'PAID') return 'PAID';
  if (total > 0 && paid + credited >= total && (paid > 0 || credited > 0)) return 'PAID';
  if (paid > 0 || current === 'PARTIALLY_PAID') return 'PARTIALLY_PAID';
  if (issued || current === 'SENT') return 'SENT';
  return 'DRAFT';
}

export const balanceOf = (total: number, paid: number, credited = 0): number => Math.max(0, total - paid - credited);

// What is still owed on an invoice, and what is owed back to the couple when credits and payments together pass the total.
// A cancelled invoice owes nothing either way.
export function invoiceMoney(i: { total: number; paid: number; credited?: number; voided?: boolean }): { net: number; outstanding: number; refundOwed: number } {
  if (i.voided) return { net: 0, outstanding: 0, refundOwed: 0 };
  const credited = i.credited ?? 0;
  return { net: i.total - credited, outstanding: Math.max(0, i.total - i.paid - credited), refundOwed: Math.max(0, i.paid + credited - i.total) };
}

export type ManualPaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
export const MANUAL_PAYMENT_METHODS: readonly ManualPaymentMethod[] = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'];

// Why a manual payment cannot be recorded (null = fine). The amount must be a whole number of rupees and must not exceed what
// is still owed — recording more than the balance would push the ledger past the agreed total.
export function checkManualPayment(input: { amount: number; total: number; paid: number; method: string; credited?: number; voided?: boolean }): string | null {
  if (input.voided) return 'This invoice is cancelled — it cannot take a payment';
  if (!(MANUAL_PAYMENT_METHODS as readonly string[]).includes(input.method)) return 'Choose how the payment was received';
  if (!Number.isInteger(input.amount) || input.amount <= 0) return 'Enter the amount received in whole rupees';
  const balance = balanceOf(input.total, input.paid, input.credited ?? 0);
  if (balance <= 0) return 'This invoice is already fully paid';
  if (input.amount > balance) return `The amount is more than the balance due (₹${balance.toLocaleString('en-IN')})`;
  return null;
}

// ---------- the invoices of an accepted agreement ----------

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// The agreement's own numbers: what was agreed, what falls due first, and what is left. Read from the ACCEPTED quotation only.
export function agreementFigures(q: { total: number; advanceAmount: number }): { total: number; advance: number; balance: number } {
  return { total: q.total, advance: q.advanceAmount, balance: Math.max(0, q.total - q.advanceAmount) };
}

// Why a balance invoice cannot be raised (null = it can). The accepted quotation is the only source: an older or unaccepted
// quotation never generates an invoice, and there is one balance invoice per agreement.
export function checkBalanceInvoice(input: {
  quotation: { status: string; total: number; advanceAmount: number; quotationNumber: string } | null;
  alreadyHasBalanceInvoice: boolean;
  // Money v1: the confirmation amount the agreement froze. When given it is the advance the balance is measured from.
  advance?: number;
}): string | null {
  const { quotation } = input;
  if (!quotation) return 'This wedding has no accepted quotation to invoice from';
  if (quotation.status !== 'ACCEPTED') {
    return `Quotation ${quotation.quotationNumber} is ${quotation.status.toLowerCase()} — only the accepted quotation can be invoiced`;
  }
  if (input.alreadyHasBalanceInvoice) return `A balance invoice was already created for quotation ${quotation.quotationNumber}`;
  if (agreementFigures({ total: quotation.total, advanceAmount: input.advance ?? quotation.advanceAmount }).balance <= 0) return 'There is no balance left after the advance — nothing more to invoice';
  return null;
}

export function planBalanceInvoice(input: {
  quotation: { quotationNumber: string; total: number; advanceAmount: number; gstAmount?: number | null; sellerGstin?: string | null };
  wedding: { primaryDate: Date | null; weddingType: string | null };
  client: { name: string; phone: string; email?: string | null; city?: string | null };
  advance?: number; // Money v1: the agreement's frozen confirmation amount, when there is one
}) {
  const { quotation, wedding, client } = input;
  const advance = input.advance ?? quotation.advanceAmount;
  const { balance } = agreementFigures({ total: quotation.total, advanceAmount: advance });
  // The GST the first invoice did not carry (lib/invoice/gstShare.ts) — none unless the quotation charges GST under a frozen GST number.
  const tax = balanceInvoiceGst(balance, advance, quotation);
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
      total: balance,
      notes: `Balance against quotation ${quotation.quotationNumber} (quotation total ${inr(quotation.total)}, advance ${inr(advance)}). ${tax.gst > 0 ? `Includes GST ${inr(tax.gst)} (GSTIN ${tax.sellerGstin}).` : 'No tax applied.'}`,
    },
    items: [{ description: `Balance — ${quotation.quotationNumber}`, amount: balance, quantity: 1 as const }],
  };
}

// ---------- credit notes and void (money design v1, PR 7) ----------

// A credit note: whole rupees, never more than what is left to credit, with a reason (the couple sees it). Its GST share follows the
// invoice's own GST in proportion, so the taxable value and the tax both go down together.
export function checkCreditNote(
  input: { amount: unknown; reason: unknown },
  inv: { total: number; credited: number; gstAmount: number; voided: boolean; issued: boolean; hasWedding: boolean }
): { ok: true; value: { amount: number; gstAmount: number; reason: string } } | { ok: false; error: string } {
  if (!inv.hasWedding) return { ok: false, error: 'Credit notes are only for a wedding’s invoices' };
  if (inv.voided) return { ok: false, error: 'This invoice is cancelled — there is nothing to credit' };
  if (!inv.issued) return { ok: false, error: 'This invoice is not issued yet — change it instead of crediting it' };
  const amount = typeof input.amount === 'number' ? input.amount : Number(String(input.amount ?? '').replace(/[,\s₹]/g, ''));
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: 'Enter the credit in whole rupees' };
  const left = inv.total - inv.credited;
  if (left <= 0) return { ok: false, error: 'This invoice is already fully credited' };
  if (amount > left) return { ok: false, error: `The credit is more than what is left to credit on this invoice (${inr(left)})` };
  const reason = typeof input.reason === 'string' ? input.reason.replace(/\s+/g, ' ').trim() : '';
  if (reason.length < 3) return { ok: false, error: 'Say why the couple is credited — it is printed on the credit note' };
  if (reason.length > 300) return { ok: false, error: 'Keep the reason under 300 characters' };
  const gstAmount = inv.total > 0 && inv.gstAmount > 0 ? Math.round((amount * inv.gstAmount) / inv.total) : 0;
  return { ok: true, value: { amount, gstAmount: Math.min(gstAmount, amount), reason } };
}

// Cancelling an invoice: only one the couple never paid and that has no credit notes. The advance and balance invoices of an
// agreement are corrected with a credit note instead (they carry the 25% confirmation and the balance rules).
export function checkVoid(
  input: { reason: unknown },
  inv: { kind: string; paid: number; credited: number; voided: boolean; hasWedding: boolean }
): { ok: true; value: { reason: string } } | { ok: false; error: string } {
  if (!inv.hasWedding) return { ok: false, error: 'Only a wedding’s invoices can be cancelled here' };
  if (inv.voided) return { ok: false, error: 'This invoice is already cancelled' };
  if (inv.kind === 'ADVANCE' || inv.kind === 'BALANCE') return { ok: false, error: 'The advance and balance invoices of the agreement are not cancelled — issue a credit note instead' };
  if (inv.paid > 0) return { ok: false, error: 'This invoice has payments — issue a credit note instead' };
  if (inv.credited > 0) return { ok: false, error: 'This invoice has credit notes — it cannot be cancelled' };
  const reason = typeof input.reason === 'string' ? input.reason.replace(/\s+/g, ' ').trim() : '';
  if (reason.length < 3) return { ok: false, error: 'Say why the invoice is cancelled' };
  if (reason.length > 300) return { ok: false, error: 'Keep the reason under 300 characters' };
  return { ok: true, value: { reason } };
}
