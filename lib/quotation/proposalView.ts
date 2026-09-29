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
export function nextStep(p: Pick<CustomerProposal, 'state' | 'changesRequested' | 'booked' | 'advanceAmount'>): string {
  const rupees = `₹${p.advanceAmount.toLocaleString('en-IN')}`;
  if (p.state === 'ACCEPTED') {
    if (p.booked) return 'Your booking is confirmed. Your Shaadi Shopping team will be in touch about the next steps.';
    return p.advanceAmount > 0
      ? `Thank you for accepting. Our team will contact you about the advance of ${rupees} to confirm your booking.`
      : 'Thank you for accepting. Our team will contact you to confirm your booking.';
  }
  if (p.state === 'EXPIRED') return 'This proposal has expired. Please contact us and we will send you an updated proposal.';
  if (p.changesRequested) return 'We have received your request for changes and will send you an updated proposal. You can still accept this version if you prefer.';
  return 'Please review the proposal. If everything looks right, accept it below — or tell us what you would like to change.';
}
