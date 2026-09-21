// The commercial agreement: what an accepted quotation was booked on, frozen at booking time (prisma CommercialAgreement), and how a
// payment is applied against it. Pure and free of server imports.
//
// The accepted quotation stays THE commercial source. The snapshot exists so nothing that changes later — a venue's default terms, a
// vendor's price, a quotation default, the business rules (lib/commercial/rules.ts) — can re-price or re-word a deal already made.
// It deliberately copies only what was ACCEPTED (amounts, rule values, items, terms); it never copies what stays live (vendor
// confirmation, payouts, tasks, coordinator, wedding stage, RSVPs, payment status, the amount received, current vendor prices).
import { COMMERCIAL_RULES, requiredConfirmation, type CommercialRules } from './rules';

export interface AcceptedQuotationForSnapshot {
  id: string;
  revision: number;
  subtotal: number;
  discount: number;
  gstAmount: number;
  total: number;
  terms: string | null;
  acceptedAt: Date | null;
  acceptedById: string | null;
  items: {
    id: string;
    description: string;
    category: string | null;
    functionLabel: string | null;
    vendorId: string | null;
    unitPrice: number;
    quantity: number;
  }[];
}

// One accepted line. `itemId` is the quotation item's own id (no duplicate commercial record is invented).
export interface AgreementItem {
  itemId: string;
  name: string;
  description: string;
  category: string | null;
  vendorId: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  functionLabel: string | null;
}

export function buildAgreementSnapshot(input: {
  quotation: AcceptedQuotationForSnapshot;
  customer: { name: string; phone: string; customerId?: string | null };
  bookingId?: string | null;
  rules?: CommercialRules;
}) {
  const { quotation, customer } = input;
  const rules = input.rules ?? COMMERCIAL_RULES;
  const items: AgreementItem[] = quotation.items.map((i) => ({
    itemId: i.id,
    name: i.description,
    description: i.description,
    category: i.category,
    vendorId: i.vendorId,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    total: i.unitPrice * i.quantity,
    functionLabel: i.functionLabel?.trim() || null,
  }));
  return {
    quotationId: quotation.id,
    quotationRevision: quotation.revision,
    bookingId: input.bookingId ?? null,
    customerId: customer.customerId ?? null,
    customerName: customer.name,
    customerPhone: customer.phone,
    currency: 'INR',
    subtotal: quotation.subtotal,
    discountAmount: quotation.discount,
    taxAmount: quotation.gstAmount,
    agreementTotal: quotation.total,
    confirmationPercent: rules.confirmationPercent,
    confirmationAmount: requiredConfirmation(quotation.total, rules),
    confirmationRounding: rules.rounding,
    holdWindowDays: rules.holdWindowDays,
    termsSnapshot: quotation.terms,
    itemsSnapshot: items,
    functionLabels: [...new Set(items.map((i) => i.functionLabel).filter((l): l is string => Boolean(l)))],
    acceptedAt: quotation.acceptedAt,
    acceptedById: quotation.acceptedById,
  };
}

// ---------- applying a payment ----------

export type PaymentTarget = 'ADVANCE' | 'BALANCE';

export interface PaymentSplit {
  target: PaymentTarget;
  amount: number;
}

// A payment is applied to the advance (confirmation) invoice first, up to what is still owed on it, and the rest to the balance
// invoice. That keeps every invoice's own arithmetic true — an invoice is never paid beyond its total — while allowing a customer to
// pay MORE than the 25% (25% is a minimum, not a maximum). The whole payment can never exceed what is still owed on the agreement.
export function planPaymentSplit(input: {
  amount: number;
  agreementTotal: number;
  confirmationAmount: number;
  advancePaid: number;
  balancePaid: number;
}): { ok: true; splits: PaymentSplit[] } | { ok: false; error: string } {
  const { amount, agreementTotal, confirmationAmount } = input;
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: 'Enter the amount received in whole rupees' };
  const advanceDue = Math.max(0, confirmationAmount - input.advancePaid);
  const balanceDue = Math.max(0, agreementTotal - confirmationAmount - input.balancePaid);
  const owed = advanceDue + balanceDue;
  if (owed <= 0) return { ok: false, error: 'This agreement is already fully paid' };
  if (amount > owed) return { ok: false, error: `The amount is more than the balance due (₹${owed.toLocaleString('en-IN')})` };
  const toAdvance = Math.min(amount, advanceDue);
  const toBalance = amount - toAdvance;
  return { ok: true, splits: [...(toAdvance > 0 ? [{ target: 'ADVANCE' as const, amount: toAdvance }] : []), ...(toBalance > 0 ? [{ target: 'BALANCE' as const, amount: toBalance }] : [])] };
}
