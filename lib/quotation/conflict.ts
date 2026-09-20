// When the database says a lead "already has an open/accepted quotation" (a unique-rule violation on the lead's quotations),
// the bare rule name means nothing to an operator — and, worse, when it fires unexpectedly it hides the very facts needed to
// understand it. This turns a FRESH read of the lead's quotations into one plain sentence that names the quotations involved.
// Pure and free of server imports.

export interface QuoteFact {
  quotationNumber: string;
  status: string;
  revision: number;
}

const STATUS_WORDS: Record<string, string> = {
  DRAFT: 'draft',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  REJECTED: 'declined',
  EXPIRED: 'expired',
  SUPERSEDED: 'replaced',
};

const describe = (q: QuoteFact) => `${q.quotationNumber} (${STATUS_WORDS[q.status] ?? q.status.toLowerCase()}${q.revision > 1 ? `, revision ${q.revision}` : ''})`;

export function describeSourceConflict(sourceLabel: string, quotes: QuoteFact[]): string {
  const open = quotes.filter((q) => q.status === 'DRAFT' || q.status === 'SENT');
  const accepted = quotes.filter((q) => q.status === 'ACCEPTED');
  const all = quotes.map(describe).join(', ') || 'none';

  if (accepted.length > 0 && open.length === 0) {
    return `This ${sourceLabel} already has an accepted quotation: ${accepted.map(describe).join(', ')}.`;
  }
  if (open.length > 0) {
    return `This ${sourceLabel} already has an open quotation: ${open.map(describe).join(', ')}. If you just pressed Revise, refresh the page to see it; otherwise edit or send it first.`;
  }
  // The database reported a clash but nothing open is visible now — say exactly what IS there, so it can be traced.
  return `The database reported an open or accepted quotation on this ${sourceLabel}, but none is visible now (quotations on this ${sourceLabel}: ${all}). Please try once more and tell us if it repeats.`;
}
