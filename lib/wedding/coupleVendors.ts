// Couple vendors and "Ask for a quote" (22 Nov 2026, Client OS → Vendors) — pure rules shared by the service, the API and the screens.
//
// Two different things, never mixed:
//   - an OUTSIDE vendor the couple found themselves: their own record, labelled as added by them, not a Shaadi Shopping partner, no
//     commission, never verified by us, never a VendorBooking or payout;
//   - a QUOTE REQUEST to a vendor listed on Shaadi Shopping: Shaadi Shopping coordinates it and, if it goes ahead, books the vendor as a
//     normal VendorBooking (where partner terms and commission apply as for any booking).

export const QUOTE_STATUSES = ['REQUESTED', 'QUOTED', 'NOT_AVAILABLE', 'BOOKED', 'CLOSED'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_WORDS: Record<QuoteStatus, string> = {
  REQUESTED: 'Enquiry sent · not booked yet',
  QUOTED: 'Price shared · not booked yet',
  NOT_AVAILABLE: 'Not available',
  BOOKED: 'Booked',
  CLOSED: 'Closed',
};

export interface OwnVendorInput {
  name: string;
  category: string;
  phone?: string | null;
  price?: number | null;
  notes?: string | null;
  weddingEventId?: string | null;
}

// A 10-digit Indian mobile, from "+91 98765 43210", "098765-43210" … (null when blank; undefined when it is not a mobile).
export function normaliseMobile(raw: string | null | undefined): string | null | undefined {
  if (!raw || !raw.trim()) return null;
  const digits = raw.replace(/\D/g, '').replace(/^(?:91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : undefined;
}

export function ownVendorProblem(input: OwnVendorInput): string | null {
  const name = input.name?.trim() ?? '';
  const category = input.category?.trim() ?? '';
  if (!name) return 'Add the vendor’s name';
  if (name.length > 100) return 'Keep the name under 100 characters';
  if (!category) return 'Say what they do (for example “Photographer”)';
  if (category.length > 60) return 'Keep the service under 60 characters';
  if (normaliseMobile(input.phone) === undefined) return 'Phone should be a 10-digit mobile number';
  if (input.price !== null && input.price !== undefined && (!Number.isInteger(input.price) || input.price < 0 || input.price > 100_000_000)) return 'Price should be whole rupees';
  if (input.notes && input.notes.trim().length > 500) return 'Keep the notes under 500 characters';
  return null;
}

// Who may move a quote request where. Staff: from the couple's request to an answer; an answer can be corrected; BOOKED and CLOSED are
// ends (a closed one is reopened only by the couple asking again). QUOTED and NOT_AVAILABLE need a note the couple reads.
const STAFF_MOVES: Record<QuoteStatus, QuoteStatus[]> = {
  REQUESTED: ['QUOTED', 'NOT_AVAILABLE', 'BOOKED', 'CLOSED'],
  QUOTED: ['BOOKED', 'NOT_AVAILABLE', 'CLOSED'],
  NOT_AVAILABLE: ['QUOTED', 'CLOSED'],
  BOOKED: ['CLOSED'],
  CLOSED: [],
};

export function staffMoveProblem(from: QuoteStatus, to: QuoteStatus, note: string | null | undefined): string | null {
  if (!STAFF_MOVES[from].includes(to)) return `A request that is “${QUOTE_STATUS_WORDS[from].toLowerCase()}” cannot become “${QUOTE_STATUS_WORDS[to].toLowerCase()}”`;
  if ((to === 'QUOTED' || to === 'NOT_AVAILABLE') && !note?.trim()) return to === 'QUOTED' ? 'Write the price and what it includes — the couple reads this' : 'Tell the couple why';
  if (note && note.trim().length > 500) return 'Keep the note under 500 characters';
  return null;
}

// The couple asking (again). A live request is shown as it is; a closed or "not available" one starts again.
export function askAgainOutcome(existing: QuoteStatus | null): 'CREATE' | 'REOPEN' | 'KEEP' {
  if (existing === null) return 'CREATE';
  return existing === 'CLOSED' || existing === 'NOT_AVAILABLE' ? 'REOPEN' : 'KEEP';
}
