// How the couple's proposal page presents a CustomerProposal (docs/wedding-os/08-quotation.md §16). Pure and client-safe
// (type-only import), so the page and the tests share one set of rules.
import type { CustomerProposal } from '@/lib/quotation/proposal';

type Item = CustomerProposal['items'][number];

export type StatusTone = 'open' | 'changes' | 'accepted' | 'booked' | 'expired';

export function proposalStatus(p: Pick<CustomerProposal, 'state' | 'changesRequested' | 'booked'>): { label: string; tone: StatusTone } {
  if (p.state === 'ACCEPTED') return p.booked ? { label: 'Booked', tone: 'booked' } : { label: 'Accepted', tone: 'accepted' };
  if (p.state === 'EXPIRED') return { label: 'Expired', tone: 'expired' };
  return p.changesRequested ? { label: 'Changes requested', tone: 'changes' } : { label: 'Awaiting your response', tone: 'open' };
}

// Grouped by function ("Wedding", "Mehndi" …) only when EVERY line has one — otherwise one list in the quote's own
// order. A function is never guessed.
export function groupByFunction(items: Item[]): { title: string | null; items: Item[] }[] {
  if (items.length === 0) return [];
  if (!items.every((i) => i.functionLabel && i.functionLabel.trim())) return [{ title: null, items }];
  const groups: { title: string; items: Item[] }[] = [];
  for (const item of items) {
    const title = item.functionLabel!.trim();
    const group = groups.find((g) => g.title.toLowerCase() === title.toLowerCase());
    if (group) group.items.push(item);
    else groups.push({ title, items: [item] });
  }
  return groups;
}

// What happens next, in plain words — only facts the proposal carries (the advance amount), nothing promised beyond it.
export function nextStep(p: Pick<CustomerProposal, 'state' | 'changesRequested' | 'booked' | 'advanceAmount'> & { brand?: CustomerProposal['brand'] }): string {
  const rupees = `₹${p.advanceAmount.toLocaleString('en-IN')}`;
  if (p.state === 'ACCEPTED') {
    if (p.booked) return `Your booking is confirmed. Your ${p.brand?.name ?? 'Shaadi Shopping'} team will be in touch about the next steps.`;
    return p.advanceAmount > 0
      ? `Thank you for accepting. Our team will contact you about the advance of ${rupees} to confirm your booking.`
      : 'Thank you for accepting. Our team will contact you to confirm your booking.';
  }
  if (p.state === 'EXPIRED') return 'This proposal has expired. Please contact us and we will send you an updated proposal.';
  if (p.changesRequested) return 'We have received your request for changes and will send you an updated proposal. You can still accept this version if you prefer.';
  return 'Take a look at your curated wedding below. When you are ready, review the detailed quotation and accept it there — or tell us what you would like to change.';
}

// Decision 10 / master doc §45: the proposal and the detailed quotation are separate experiences on the same link.
export type ProposalTab = 'proposal' | 'quotation';

// "#quotation" opens the detailed quotation directly (staff can send that link); anything else is the proposal.
export function tabFromHash(hash: string): ProposalTab {
  return hash.replace(/^#/, '').toLowerCase() === 'quotation' ? 'quotation' : 'proposal';
}

// The proposal view carries key commercial information only — never the accounting breakdown.
export function proposalHighlights(p: Pick<CustomerProposal, 'total' | 'advanceAmount'>): { label: string; amount: number }[] {
  const rows = [{ label: 'Total for your wedding', amount: p.total }];
  if (p.advanceAmount > 0) rows.push({ label: 'Advance to confirm', amount: p.advanceAmount });
  return rows;
}

// The detailed quotation's commercial summary. The balance is derived here and never stored.
export function quotationSummary(
  p: Pick<CustomerProposal, 'subtotal' | 'discount' | 'gstAmount' | 'total' | 'advanceAmount'>
): { label: string; amount: number; kind: 'plain' | 'discount' | 'total' | 'advance' }[] {
  const rows: { label: string; amount: number; kind: 'plain' | 'discount' | 'total' | 'advance' }[] = [{ label: 'Subtotal', amount: p.subtotal, kind: 'plain' }];
  if (p.discount > 0) rows.push({ label: 'Discount', amount: p.discount, kind: 'discount' });
  if (p.gstAmount != null) rows.push({ label: 'GST', amount: p.gstAmount, kind: 'plain' });
  rows.push({ label: 'Total', amount: p.total, kind: 'total' });
  if (p.advanceAmount > 0) {
    rows.push({ label: 'Advance to confirm', amount: p.advanceAmount, kind: 'advance' });
    rows.push({ label: 'Balance', amount: Math.max(0, p.total - p.advanceAmount), kind: 'plain' });
  }
  return rows;
}

// Quick choices for "Request changes" — they only start the note; the couple's own words are what is sent.
export const REQUEST_CHOICES: { label: string; start: string }[] = [
  { label: 'Show me another option', start: 'Please show me another option for ' },
  { label: 'I have a question', start: 'I have a question: ' },
  { label: 'Change something else', start: 'Please change ' },
];

// Who the couple calls and messages from this link (D8): Shaadi Shopping's number for its own quotations; the venue's own number
// for a venue's quotation. A venue with no usable number gets no call / WhatsApp links — never Shaadi Shopping's in its place.
export interface ProposalContact {
  name: string;
  isPlatform: boolean;
  phone: { tel: string; display: string; whatsApp: (message: string) => string } | null;
}

export function proposalContact(brand: CustomerProposal['brand'], platform: { phone: string; display: string }): ProposalContact {
  const whatsApp = (e164: string) => (message: string) => `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
  if (brand.isPlatform) return { name: brand.name, isPlatform: true, phone: { tel: platform.phone, display: platform.display, whatsApp: whatsApp(platform.phone) } };
  if (!brand.phone || !/^[6-9]\d{9}$/.test(brand.phone)) return { name: brand.name, isPlatform: false, phone: null };
  const e164 = `+91${brand.phone}`;
  return { name: brand.name, isPlatform: false, phone: { tel: e164, display: `+91 ${brand.phone.slice(0, 5)} ${brand.phone.slice(5)}`, whatsApp: whatsApp(e164) } };
}

// The Shaadi Shopping section on a venue's own proposal link (Phase C): a separate, clearly labelled offer to help with the rest
// of the wedding. It is the only place a venue's link carries Shaadi Shopping's number — questions about THIS quotation still go
// to the venue (proposalContact). A Shaadi Shopping proposal is already Shaadi Shopping's, so it has no such section. The message
// the couple sends names the venue only: never the couple, the quotation number or the link.
export interface ShaadiSection {
  venueName: string;
  tel: string;
  display: string;
  whatsApp: string;
}

export function shaadiSection(brand: CustomerProposal['brand'], platform: { phone: string; display: string }): ShaadiSection | null {
  if (brand.isPlatform) return null;
  const message = `Namaste Shaadi Shopping, I am planning my wedding with ${brand.name} and would like help with the rest of it.`;
  return { venueName: brand.name, tel: platform.phone, display: platform.display, whatsApp: `https://wa.me/${platform.phone}?text=${encodeURIComponent(message)}` };
}
