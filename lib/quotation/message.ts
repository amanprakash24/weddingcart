// The prepared customer message for a sent quotation (docs/wedding-os/08-quotation.md §6.2).
//
// V1 sends nothing by itself: staff copy this text (or open WhatsApp with it prefilled) and
// send it themselves. Pure and free of server imports, so the admin UI can use it directly.
//
// The contact line always points at Shaadi Shopping's own number — never a venue's.
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

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function formatQuoteDate(value: Date | string | null): string | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(date);
}

export function buildQuotationMessage(q: QuotationMessageInput, customerName?: string | null): string {
  const lines: string[] = [];
  lines.push(`Namaste${customerName?.trim() ? ` ${customerName.trim()}` : ''},`);
  lines.push('');
  lines.push(`Here is your wedding quotation from Shaadi Shopping (${q.quotationNumber}):`);
  lines.push('');
  q.items.forEach((item, index) => {
    const lineTotal = item.unitPrice * item.quantity;
    lines.push(
      item.quantity === 1
        ? `${index + 1}. ${item.description}: ${rupees(lineTotal)}`
        : `${index + 1}. ${item.description}: ${item.quantity} × ${rupees(item.unitPrice)} = ${rupees(lineTotal)}`
    );
  });
  lines.push('');
  if (q.discount > 0 || (q.gstEnabled && q.gstAmount > 0)) lines.push(`Subtotal: ${rupees(q.subtotal)}`);
  if (q.discount > 0) lines.push(`Discount: −${rupees(q.discount)}`);
  if (q.gstEnabled && q.gstAmount > 0) lines.push(`Tax: ${rupees(q.gstAmount)}`);
  lines.push(`Total: ${rupees(q.total)}`);
  if (q.advanceAmount > 0) {
    lines.push(`Advance to confirm: ${rupees(q.advanceAmount)}`);
    lines.push(`Balance: ${rupees(q.total - q.advanceAmount)}`);
  }
  const until = formatQuoteDate(q.validUntil);
  if (until) lines.push(`Valid until: ${until}`);
  if (q.terms?.trim()) {
    lines.push('');
    lines.push(q.terms.trim());
  }
  lines.push('');
  lines.push(`To confirm or discuss, reply here or call us on ${SHAADI_PHONE_DISPLAY}.`);
  return lines.join('\n');
}
