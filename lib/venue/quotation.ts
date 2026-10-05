// A venue's OWN quotation for one of its own enquiries (Phase C). Deliberately simpler than Shaadi Shopping's quotation screen:
// plain lines (what, how many, price), a discount, a valid-until date and what is / is not included. No tax line (a tax amount
// needs the venue's GST number on the quotation, the invoice and the couple's link — that comes together, later) and no other
// vendors on the lines. The amount that confirms the booking is never typed: it is the venue's own rule (Settings) applied to the
// total. Pure and client-safe: the form and the server share these rules.

export const VENUE_QUOTE_LIMITS = { maxLines: 30, descriptionMax: 200, textMax: 4000, maxUnitPrice: 100_000_000, maxQuantity: 100_000 } as const;

export interface VenueQuoteLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface VenueQuoteInput {
  items: VenueQuoteLine[];
  discount: number;
  validUntil: string; // YYYY-MM-DD — valid through the end of that day in IST
  inclusions: string | null;
  exclusions: string | null;
  terms: string | null;
}

// One message per box. Line boxes are keyed "items.<row>.<field>"; "items" is the list as a whole.
export type VenueQuoteErrors = Record<string, string>;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const whole = (raw: string) => (/^\d{1,10}$/.test(raw) ? Number(raw) : null);
const rupeeText = (raw: string) => raw.replace(/[₹,\s]/g, '');

export const lineTotal = (l: Pick<VenueQuoteLine, 'quantity' | 'unitPrice'>) => l.quantity * l.unitPrice;

export function validateVenueQuote(input: Record<string, unknown>, today: string): { ok: true; value: VenueQuoteInput } | { ok: false; errors: VenueQuoteErrors } {
  const errors: VenueQuoteErrors = {};
  const L = VENUE_QUOTE_LIMITS;

  const rawItems = Array.isArray(input.items) ? (input.items as Record<string, unknown>[]) : [];
  const items: VenueQuoteLine[] = [];
  if (rawItems.length === 0) errors.items = 'Add at least one line';
  else if (rawItems.length > L.maxLines) errors.items = `Please keep it to ${L.maxLines} lines`;
  else {
    rawItems.forEach((raw, i) => {
      const description = str(raw?.description).replace(/\s+/g, ' ');
      if (!description) errors[`items.${i}.description`] = 'Say what this line is for';
      else if (description.length > L.descriptionMax) errors[`items.${i}.description`] = `Please keep it under ${L.descriptionMax} characters`;

      const quantity = whole(str(raw?.quantity) || '1');
      if (quantity === null || quantity < 1 || quantity > L.maxQuantity) errors[`items.${i}.quantity`] = 'Enter how many — 1 or more';

      const unitPrice = whole(rupeeText(str(raw?.unitPrice)));
      if (unitPrice === null || unitPrice > L.maxUnitPrice) errors[`items.${i}.unitPrice`] = 'Enter the price in whole rupees';

      items.push({ description, quantity: quantity ?? 1, unitPrice: unitPrice ?? 0 });
    });
  }

  const subtotal = items.reduce((sum, l) => sum + lineTotal(l), 0);
  const discountRaw = rupeeText(str(input.discount));
  const discount = discountRaw ? whole(discountRaw) : 0;
  if (discount === null) errors.discount = 'Enter the discount in whole rupees, or leave it empty';
  else if (!Object.keys(errors).length && discount > subtotal) errors.discount = 'The discount is more than the total of the lines';
  if (!Object.keys(errors).length && subtotal - (discount ?? 0) <= 0) errors.items = 'The total must be more than ₹0';

  const validUntil = str(input.validUntil);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil) || Number.isNaN(new Date(`${validUntil}T23:59:59+05:30`).getTime())) errors.validUntil = 'Pick the date this quotation is valid until';
  else if (validUntil < today) errors.validUntil = 'Pick today or a later date';

  const text = (key: 'inclusions' | 'exclusions' | 'terms') => {
    const value = str(input[key]);
    if (value.length > L.textMax) errors[key] = `Please keep this under ${L.textMax} characters`;
    return value || null;
  };
  const inclusions = text('inclusions');
  const exclusions = text('exclusions');
  const terms = text('terms');

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { items, discount: discount ?? 0, validUntil, inclusions, exclusions, terms } };
}

// ---------- where a quotation stands, in the venue's words ----------

// DRAFT: being written · SENT: with the couple · CHANGES: the couple asked for changes · ACCEPTED: the couple said yes ·
// ENDED: expired or declined (a new one can be made from it).
export type QuoteStage = 'DRAFT' | 'SENT' | 'CHANGES' | 'ACCEPTED' | 'ENDED';

export function quoteStage(q: { status: string; changesRequested: boolean }): QuoteStage | null {
  switch (q.status) {
    case 'DRAFT':
      return 'DRAFT';
    case 'SENT':
      return q.changesRequested ? 'CHANGES' : 'SENT';
    case 'ACCEPTED':
      return 'ACCEPTED';
    case 'EXPIRED':
    case 'REJECTED':
      return 'ENDED';
    default:
      return null; // replaced by a newer revision — never the current one
  }
}

export const QUOTE_STAGE_LABEL: Record<QuoteStage, string> = {
  DRAFT: 'Draft — not sent yet',
  SENT: 'Sent',
  CHANGES: 'Changes requested',
  ACCEPTED: 'Accepted',
  ENDED: 'No longer valid',
};

// What the venue sends on WhatsApp with the couple's link. The venue's own words to its own customer.
export function quoteShareMessage(input: { customerName: string; venueName: string; number: string; total: number; url: string }): string {
  const first = input.customerName.split(' ')[0];
  return [
    `Namaste ${first},`,
    `Here is your quotation from ${input.venueName} (${input.number}) — total ₹${input.total.toLocaleString('en-IN')}.`,
    `See the details, and accept it or ask for changes, here: ${input.url}`,
  ].join('\n');
}
