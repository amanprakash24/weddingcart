// Confirming chosen services of a quotation (money design v1, PR 8, 25 Nov 2026). Pure and free of server imports.
//
// A confirmation is the unit of money: the services the couple confirmed together, frozen line by line, with their own 25% advance
// and balance. Unconfirmed services stay on the quotation for later. Every figure is taken from the quotation's own calculation
// (lib/quotation/lineGst.ts: each line's discount share and GST), so the confirmations of a quotation add up to its total exactly:
// when the last services are confirmed, any rupee left over by rounding goes to that last confirmation.
import { gstTotals, spreadDiscount } from '@/lib/quotation/lineGst';
import { COMMERCIAL_RULES, requiredConfirmation, type CommercialRules } from './rules';

export interface ConfirmableQuotation {
  quotationNumber: string;
  status: string;
  subtotal: number;
  discount: number;
  gstAmount: number;
  total: number;
  items: {
    id: string;
    description: string;
    category: string | null;
    functionLabel: string | null;
    vendorId: string | null;
    unitPrice: number;
    quantity: number;
    gstRateBp: number | null;
  }[];
}

// One confirmed line, frozen: what the couple pays for this service, whatever happens to the quotation afterwards.
export interface ConfirmationLine {
  quotationItemId: string;
  description: string;
  category: string | null;
  functionLabel: string | null;
  vendorId: string | null;
  quantity: number;
  unitPrice: number;
  amount: number; // quantity × unit price
  discountShare: number;
  taxable: number; // amount − discount share
  gstRateBp: number | null;
  gst: number;
  total: number; // taxable + gst
}

export interface ConfirmationPlan {
  lines: ConfirmationLine[];
  subtotal: number;
  discount: number;
  taxable: number;
  gst: number;
  total: number;
  confirmationPercent: number;
  advance: number; // the 25% that confirms it
  balance: number;
  isLast: boolean; // every service of the quotation is confirmed after this one
}

// A quotation can have services confirmed while it is SENT. It stays SENT while partly confirmed — 'partly confirmed' is read from its
// live confirmations, never a separate status (44 places compare quotation statuses by text; a new one would slip past them). A
// draft is not agreed yet; an accepted, rejected, expired or superseded quotation is finished.
export const CONFIRMABLE_STATUSES = ['SENT'] as const;

export function planConfirmation(input: {
  quotation: ConfirmableQuotation;
  chosenItemIds: string[];
  confirmed: { itemIds: string[]; total: number }; // the quotation's live (not cancelled) confirmations so far
  rules?: Pick<CommercialRules, 'confirmationPercent'>;
}): { ok: true; value: ConfirmationPlan } | { ok: false; error: string } {
  const { quotation } = input;
  const rules = input.rules ?? COMMERCIAL_RULES;
  if (!(CONFIRMABLE_STATUSES as readonly string[]).includes(quotation.status)) {
    return { ok: false, error: `Quotation ${quotation.quotationNumber} is ${quotation.status.toLowerCase().replace(/_/g, ' ')} — only a sent quotation can have services confirmed` };
  }
  const chosen = [...new Set(input.chosenItemIds)];
  if (chosen.length === 0) return { ok: false, error: 'Choose at least one service to confirm' };
  const known = new Set(quotation.items.map((i) => i.id));
  if (chosen.some((id) => !known.has(id))) return { ok: false, error: 'A chosen service is not on this quotation — reload and try again' };
  const already = new Set(input.confirmed.itemIds);
  const twice = quotation.items.filter((i) => chosen.includes(i.id) && already.has(i.id));
  if (twice.length) return { ok: false, error: `Already confirmed: ${twice.map((i) => i.description).join(', ')}` };

  const calc = gstTotals(quotation.items.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity, gstRateBp: i.gstRateBp })), quotation.discount);
  // Each line's GST. Normally from its own rate. GST typed as one amount for the whole quotation (no rates on the lines — Shaadi
  // Shopping's quotation screen types it that way) is shared across the lines in proportion to their taxable value, in whole rupees
  // that add up to it exactly — the same as a single rate across every service. A mix (some rates, a total that disagrees) is refused.
  const remaining = quotation.items.filter((i) => !already.has(i.id) && !chosen.includes(i.id));
  const noRates = quotation.items.every((i) => !i.gstRateBp);
  let lineGst = calc.lines.map((l) => l.gst);
  if (calc.gst !== quotation.gstAmount) {
    if (noRates && quotation.gstAmount > 0) lineGst = spreadDiscount(calc.lines.map((l) => l.taxable), quotation.gstAmount);
    else if (remaining.length > 0) return { ok: false, error: `The GST on ${quotation.quotationNumber} does not match its lines — confirm all its services together, or revise it` };
  }

  const lines: ConfirmationLine[] = quotation.items
    .map((item, i) => ({ item, l: calc.lines[i], i }))
    .filter(({ item }) => chosen.includes(item.id))
    .map(({ item, l, i }) => ({
      quotationItemId: item.id,
      description: item.description,
      category: item.category,
      functionLabel: item.functionLabel?.trim() || null,
      vendorId: item.vendorId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: l.amount,
      discountShare: l.discount,
      taxable: l.taxable,
      gstRateBp: l.gstRateBp,
      gst: lineGst[i],
      total: l.taxable + lineGst[i],
    }));

  const isLast = remaining.length === 0;
  const sum = (f: (l: ConfirmationLine) => number) => lines.reduce((s, l) => s + f(l), 0);
  let gst = sum((l) => l.gst);
  let total = sum((l) => l.total);
  if (isLast) {
    // The confirmations of a quotation add up to its total exactly: whatever rounding left over (or a whole-quotation GST typed as one
    // amount, when everything is confirmed at once) is settled on the last one, on its GST.
    const leftover = quotation.total - input.confirmed.total - total;
    gst += leftover;
    total += leftover;
    if (gst < 0 || total <= 0) return { ok: false, error: `The confirmed amounts no longer add up to ${quotation.quotationNumber}'s total — ask for help before confirming` };
  }
  if (total <= 0) return { ok: false, error: 'The chosen services add up to nothing — choose a service with a price' };
  const advance = requiredConfirmation(total, rules);
  return {
    ok: true,
    value: { lines, subtotal: sum((l) => l.amount), discount: sum((l) => l.discountShare), taxable: sum((l) => l.taxable), gst, total, confirmationPercent: rules.confirmationPercent, advance, balance: total - advance, isLast },
  };
}

export const CONFIRMATION_CHANNELS = [
  { id: 'IN_PERSON', label: 'In person' },
  { id: 'CALL', label: 'On a call' },
  { id: 'WHATSAPP', label: 'On WhatsApp' },
  { id: 'COUPLE_LINK', label: 'On their quotation link' },
] as const;
export type ConfirmationChannel = (typeof CONFIRMATION_CHANNELS)[number]['id'];
