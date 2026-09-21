// The version history of a lead's quotations, and the Negotiation steps, for the Lead Workspace. Pure and free of server imports.
//
// Every version is kept (a revision replaces its predecessor but never deletes it), so the history is simply all of them, oldest
// first, each with what changed since the version before it.
export interface HistoryItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface HistoryQuotation {
  id: string;
  quotationNumber: string;
  revision: number;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'SUPERSEDED';
  total: number;
  discount: number;
  advanceAmount: number;
  terms: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  items: HistoryItem[];
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const lineTotal = (i: HistoryItem) => i.unitPrice * i.quantity;
const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();

// What changed from `previous` to `next`, in plain words. Empty when nothing customer-visible changed.
export function describeChanges(previous: HistoryQuotation, next: HistoryQuotation): string[] {
  const changes: string[] = [];
  if (previous.total !== next.total) changes.push(`Total ${inr(previous.total)} → ${inr(next.total)}`);

  const before = new Map(previous.items.map((i) => [i.description.trim().toLowerCase(), i]));
  const after = new Map(next.items.map((i) => [i.description.trim().toLowerCase(), i]));
  for (const [key, item] of after) {
    const old = before.get(key);
    if (!old) changes.push(`Added ${item.description.trim()} (${inr(lineTotal(item))})`);
    else if (lineTotal(old) !== lineTotal(item)) changes.push(`${item.description.trim()} ${inr(lineTotal(old))} → ${inr(lineTotal(item))}`);
  }
  for (const [key, item] of before) if (!after.has(key)) changes.push(`Removed ${item.description.trim()}`);

  if (previous.discount !== next.discount) changes.push(`Discount ${inr(previous.discount)} → ${inr(next.discount)}`);
  if (previous.advanceAmount !== next.advanceAmount) changes.push(`Advance ${inr(previous.advanceAmount)} → ${inr(next.advanceAmount)}`);
  if (norm(previous.terms) !== norm(next.terms)) changes.push('Terms & conditions changed');
  return changes;
}

export interface VersionRow {
  id: string;
  quotationNumber: string;
  revision: number;
  status: HistoryQuotation['status'];
  total: number;
  // The day it was sent, or — for a draft — created.
  date: string;
  isCurrent: boolean;
  changes: string[]; // empty for the first version
}

// Oldest first. `currentId` is whichever version the journey is about (the accepted one, else the open one).
export function buildVersionHistory(quotations: HistoryQuotation[], currentId: string | null): VersionRow[] {
  const ordered = [...quotations].sort((a, b) => a.revision - b.revision || a.createdAt.localeCompare(b.createdAt));
  return ordered.map((q, index) => ({
    id: q.id,
    quotationNumber: q.quotationNumber,
    revision: q.revision,
    status: q.status,
    total: q.total,
    date: q.sentAt ?? q.createdAt,
    isCurrent: q.id === currentId,
    changes: index === 0 ? [] : describeChanges(ordered[index - 1], q),
  }));
}

// ---------- the Negotiation steps ----------

export type StepState = 'done' | 'current' | 'todo';
export interface NegotiationStep {
  key: 'sent' | 'negotiation' | 'revised-sent' | 'accepted';
  label: string;
  state: StepState;
}

// Quotation sent → Negotiation → Revised quotation sent → Customer accepted. Shown only once a quotation has been sent.
// It reads what actually happened; nothing is assumed:
//   • Negotiation begins the moment a sent quotation is revised;
//   • "Revised quotation sent" is true once a revision (revision > 1) has itself been sent;
//   • a customer may accept the first quotation outright — steps 2 and 3 then simply stay undone.
export function negotiationSteps(quotations: HistoryQuotation[]): NegotiationStep[] | null {
  const sentEver = quotations.some((q) => q.sentAt !== null);
  if (!sentEver) return null;
  const revised = quotations.some((q) => q.revision > 1);
  const revisedSent = quotations.some((q) => q.revision > 1 && q.sentAt !== null);
  const accepted = quotations.some((q) => q.status === 'ACCEPTED');

  const steps: NegotiationStep[] = [
    { key: 'sent', label: 'Quotation sent', state: 'done' },
    { key: 'negotiation', label: 'Negotiation', state: revised ? 'done' : 'todo' },
    { key: 'revised-sent', label: 'Revised quotation sent', state: revisedSent ? 'done' : 'todo' },
    { key: 'accepted', label: 'Customer accepted', state: accepted ? 'done' : 'todo' },
  ];
  // Which step the deal is waiting on (none once accepted, or when the deal has ended).
  if (!accepted) {
    const open = quotations.some((q) => q.status === 'DRAFT' || q.status === 'SENT');
    if (open) steps.find((step) => step.key === (revised && !revisedSent ? 'revised-sent' : 'accepted'))!.state = 'current';
  }
  return steps;
}
