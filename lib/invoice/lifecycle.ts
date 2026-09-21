// The invoice lifecycle, and the balance-invoice plan. Pure and free of server imports.
//
//   DRAFT ──issue / payment link──▶ SENT ──part payment──▶ PARTIALLY_PAID ──rest──▶ PAID
//
// Status is never guessed: it is DERIVED from what actually happened — was it issued, and how much has been received. That is
// what fixes the invoice that stayed DRAFT forever after its payment link went out. (No void/cancel exists in the schema, so none
// is invented here.)
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID';

// The status an invoice should have, given whether it has been issued and how much has been received.
// - money received always means it was issued;
// - never moves backwards from what has already happened.
export function deriveInvoiceStatus(input: { current: InvoiceStatus; total: number; paid: number; issued: boolean }): InvoiceStatus {
  const { current, total, paid, issued } = input;
  if (current === 'PAID') return 'PAID';
  if (total > 0 && paid >= total) return 'PAID';
  if (paid > 0 || current === 'PARTIALLY_PAID') return 'PARTIALLY_PAID';
  if (issued || current === 'SENT') return 'SENT';
  return 'DRAFT';
}

export const balanceOf = (total: number, paid: number): number => Math.max(0, total - paid);

export type ManualPaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
export const MANUAL_PAYMENT_METHODS: readonly ManualPaymentMethod[] = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'];

// Why a manual payment cannot be recorded (null = fine). The amount must be a whole number of rupees and must not exceed what
// is still owed — recording more than the balance would push the ledger past the agreed total.
export function checkManualPayment(input: { amount: number; total: number; paid: number; method: string }): string | null {
  if (!(MANUAL_PAYMENT_METHODS as readonly string[]).includes(input.method)) return 'Choose how the payment was received';
  if (!Number.isInteger(input.amount) || input.amount <= 0) return 'Enter the amount received in whole rupees';
  const balance = balanceOf(input.total, input.paid);
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
}): string | null {
  const { quotation } = input;
  if (!quotation) return 'This wedding has no accepted quotation to invoice from';
  if (quotation.status !== 'ACCEPTED') {
    return `Quotation ${quotation.quotationNumber} is ${quotation.status.toLowerCase()} — only the accepted quotation can be invoiced`;
  }
  if (input.alreadyHasBalanceInvoice) return `A balance invoice was already created for quotation ${quotation.quotationNumber}`;
  if (agreementFigures(quotation).balance <= 0) return 'There is no balance left after the advance — nothing more to invoice';
  return null;
}

export function planBalanceInvoice(input: {
  quotation: { quotationNumber: string; total: number; advanceAmount: number };
  wedding: { primaryDate: Date; weddingType: string | null };
  client: { name: string; phone: string; email?: string | null; city?: string | null };
}) {
  const { quotation, wedding, client } = input;
  const { balance } = agreementFigures(quotation);
  return {
    invoice: {
      clientName: client.name,
      clientPhone: client.phone,
      clientEmail: client.email?.trim() || null,
      clientCity: client.city?.trim() || null,
      eventDate: wedding.primaryDate.toISOString().slice(0, 10),
      eventType: wedding.weddingType,
      subtotal: balance,
      discount: 0,
      gstEnabled: false as const,
      gstAmount: 0 as const,
      total: balance,
      notes: `Balance against quotation ${quotation.quotationNumber} (quotation total ${inr(quotation.total)}, advance ${inr(quotation.advanceAmount)}). No tax applied.`,
    },
    items: [{ description: `Balance — ${quotation.quotationNumber}`, amount: balance, quantity: 1 as const }],
  };
}
