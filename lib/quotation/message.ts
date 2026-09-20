// The prepared customer messages for a quotation (docs/wedding-os/08-quotation.md §6.2).
//
// V1 sends nothing by itself: staff copy the text (or open WhatsApp with it prefilled) and send it themselves. Every
// figure comes from the quotation passed in — nothing (advance, balance, dates) is assumed here. Written the way a
// Shaadi Shopping team member would write to a client: no internal status names, no system wording.
//
// Pure and free of server imports, so the admin UI can use it directly. The contact line always points at Shaadi
// Shopping's own number — never a venue's.
import { SHAADI_PHONE_DISPLAY } from '@/lib/shaadiContact';

export interface QuotationMessageInput {
  quotationNumber: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  discount: number;
  gstEnabled: boolean;
  gstAmount: number;
  total: number;
  advanceAmount: number;
  validUntil: Date | string | null;
  terms?: string | null;
}

export interface MessageExtras {
  // The wedding date, already in words ("5 Dec 2026"), when it is known and trustworthy. Omitted from the text otherwise.
  eventDate?: string | null;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const SIGN_OFF = '— Team Shaadi Shopping';

export function formatQuoteDate(value: Date | string | null): string | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(date);
}

function greeting(customerName?: string | null): string {
  return `Namaste${customerName?.trim() ? ` ${customerName.trim()}` : ''}`;
}

// The first message: the quotation itself.
export function buildQuotationMessage(q: QuotationMessageInput, customerName?: string | null, extras: MessageExtras = {}): string {
  const lines: string[] = [];
  lines.push(`${greeting(customerName)} 🙏`);
  lines.push('');
  lines.push(
    `Thank you for considering Shaadi Shopping for your wedding${extras.eventDate ? ` on ${extras.eventDate}` : ''}. Here is your quotation (${q.quotationNumber}):`
  );
  lines.push('');
  q.items.forEach((item) => {
    const lineTotal = item.unitPrice * item.quantity;
    lines.push(
      item.quantity === 1
        ? `• ${item.description}: ${rupees(lineTotal)}`
        : `• ${item.description}: ${item.quantity} × ${rupees(item.unitPrice)} = ${rupees(lineTotal)}`
    );
  });
  lines.push('');
  if (q.discount > 0 || (q.gstEnabled && q.gstAmount > 0)) lines.push(`Subtotal: ${rupees(q.subtotal)}`);
  if (q.discount > 0) lines.push(`Discount: −${rupees(q.discount)}`);
  if (q.gstEnabled && q.gstAmount > 0) lines.push(`Tax: ${rupees(q.gstAmount)}`);
  lines.push(`*Total: ${rupees(q.total)}*`);
  if (q.advanceAmount > 0) {
    lines.push(`Advance to confirm: ${rupees(q.advanceAmount)}`);
    lines.push(`Balance: ${rupees(q.total - q.advanceAmount)}`);
  }
  const until = formatQuoteDate(q.validUntil);
  if (until) {
    lines.push('');
    lines.push(`This quotation is valid until ${until}.`);
  }
  if (q.terms?.trim()) {
    lines.push('');
    lines.push(q.terms.trim());
  }
  lines.push('');
  lines.push(`Reply here or call us on ${SHAADI_PHONE_DISPLAY} — we are happy to adjust anything.`);
  lines.push('');
  lines.push(SIGN_OFF);
  return lines.join('\n');
}

// A gentle nudge while the quotation is still waiting for an answer.
export function buildFollowUpMessage(q: Pick<QuotationMessageInput, 'quotationNumber' | 'total' | 'validUntil'>, customerName?: string | null, sentOn?: string | null): string {
  const until = formatQuoteDate(q.validUntil);
  return [
    `${greeting(customerName)},`,
    '',
    `Just checking in on the quotation we shared${sentOn ? ` on ${sentOn}` : ''} (${q.quotationNumber}) — total ${rupees(q.total)}${until ? `, valid until ${until}` : ''}.`,
    '',
    'We would be glad to walk you through it or adjust any service. Shall we set up a quick call?',
    '',
    SIGN_OFF,
  ].join('\n');
}

// After the customer says yes: what happens next. Mentions the advance only when the quotation has one.
export function buildAcceptanceThanks(q: Pick<QuotationMessageInput, 'quotationNumber' | 'advanceAmount'>, customerName?: string | null): string {
  return [
    `Thank you${customerName?.trim() ? ` ${customerName.trim()}` : ''}! 🙏`,
    '',
    `We have noted your acceptance of quotation ${q.quotationNumber}.`,
    '',
    q.advanceAmount > 0
      ? `Next, we will confirm your booking and share the advance payment details of ${rupees(q.advanceAmount)}.`
      : 'Next, we will confirm your booking and be in touch with the details.',
    '',
    SIGN_OFF,
  ].join('\n');
}

// Once the booking is confirmed and the wedding is set up.
export function buildBookingConfirmedMessage(customerName: string | null | undefined, weddingNumber: string | null, eventDate?: string | null): string {
  return [
    `Congratulations${customerName?.trim() ? ` ${customerName.trim()}` : ''}! 🎉`,
    '',
    `Your booking${eventDate ? ` for ${eventDate}` : ''} is confirmed${weddingNumber ? `. Your wedding reference is ${weddingNumber}` : ''}.`,
    '',
    'Our team will be in touch about the next steps.',
    '',
    SIGN_OFF,
  ].join('\n');
}
