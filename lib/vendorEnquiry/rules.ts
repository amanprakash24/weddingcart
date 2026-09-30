// Vendor enquiry & response (blueprint §43, docs/wedding-os/04-vendor-os.md §9). Pure: no database.
//
// When staff link a vendor to a customer (on the consultation, or on a quote line) the vendor is asked —
// asynchronously — whether they can take it. The answer never blocks sales, and the customer never sees any of it.
// Before the couple accepts, the vendor sees operational facts only (date, city, guests, event type, service,
// function): never the couple's name or contact details, other vendors, or the customer-facing price.
import { ValidationError } from '@/lib/errors';
import { serviceLabel } from '@/lib/serviceLabels';

export * from './labels';
import { ANSWER_STATUSES, VENDOR_CHANNEL, STATUS_LABEL, type AnswerStatus, type VendorEnquiryStatus, type VendorEnquiryView } from './labels';

const NOTE_MAX = 1000;
const DATE_MAX = 60;
const AMOUNT_MAX = 1_000_000_000;

export interface AnswerInput {
  status: unknown;
  note?: unknown;
  suggestedDate?: unknown;
  quotedAmount?: unknown;
}
export interface Answer {
  status: AnswerStatus;
  note: string | null;
  suggestedDate: string | null;
  quotedAmount: number | null;
}

const text = (v: unknown, max: number, label: string): string | null => {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') throw new ValidationError(`${label} must be text`);
  const t = v.trim();
  if (t.length > max) throw new ValidationError(`${label} must be at most ${max} characters`);
  return t || null;
};

// One set of rules for every answer, whether the vendor gives it in Vendor OS or staff record it.
export function validateAnswer(input: AnswerInput): Answer {
  const status = input.status as AnswerStatus;
  if (!ANSWER_STATUSES.includes(status)) throw new ValidationError('Choose an answer');
  const note = text(input.note, NOTE_MAX, 'Note');
  const suggestedDate = text(input.suggestedDate, DATE_MAX, 'Suggested date');
  let quotedAmount: number | null = null;
  if (input.quotedAmount != null && input.quotedAmount !== '') {
    const n = Number(input.quotedAmount);
    if (!Number.isInteger(n) || n <= 0 || n > AMOUNT_MAX) throw new ValidationError('Quoted amount must be a whole number of rupees');
    quotedAmount = n;
  }
  if (status === 'AVAILABLE_WITH_CONDITIONS' && !note) throw new ValidationError('Describe the conditions');
  if (status === 'ALTERNATE_DATE' && !suggestedDate) throw new ValidationError('Give the date you can do');
  if (status === 'QUOTED' && quotedAmount == null && !note) throw new ValidationError('Give the amount or describe the package');
  return {
    status,
    note,
    suggestedDate: status === 'ALTERNATE_DATE' ? suggestedDate : null,
    quotedAmount: status === 'QUOTED' ? quotedAmount : null,
  };
}

// ---- which vendors should currently have an enquiry for a customer record ---------------------------------------

export interface EnquiryDetails {
  services: string; // "Venue, Decoration"
  functions: string | null;
  eventDate: string | null;
  guestCount: number | null;
  city: string | null;
  eventType: string | null;
  quotationId: string | null;
}
export interface DesiredEnquiry extends EnquiryDetails {
  vendorId: string;
}

export function buildDesired(
  input: {
    quotationId: string | null;
    lines: { vendorId: string | null; category: string | null; description: string; functionLabel: string | null }[];
    selections: { vendorId: string; serviceKey: string }[];
    facts: { dateText: string | null; guestCount: number | null; city: string | null; eventType: string | null } | null;
  }
): DesiredEnquiry[] {
  const byVendor = new Map<string, { services: Set<string>; functions: Set<string>; onQuote: boolean }>();
  const entry = (vendorId: string) => {
    let e = byVendor.get(vendorId);
    if (!e) byVendor.set(vendorId, (e = { services: new Set(), functions: new Set(), onQuote: false }));
    return e;
  };
  for (const line of input.lines) {
    if (!line.vendorId) continue;
    const e = entry(line.vendorId);
    e.onQuote = true;
    e.services.add(serviceLabel(line.category) ?? serviceLabel(line.description) ?? line.description);
    if (line.functionLabel?.trim()) e.functions.add(line.functionLabel.trim());
  }
  for (const s of input.selections) entry(s.vendorId).services.add(serviceLabel(s.serviceKey) ?? s.serviceKey);
  const join = (set: Set<string>) => [...set].sort((a, b) => a.localeCompare(b)).join(', ');
  return [...byVendor.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([vendorId, e]) => ({
      vendorId,
      services: join(e.services),
      functions: e.functions.size ? join(e.functions) : null,
      eventDate: input.facts?.dateText ?? null,
      guestCount: input.facts?.guestCount ?? null,
      city: input.facts?.city ?? null,
      eventType: input.facts?.eventType ?? null,
      quotationId: e.onQuote ? input.quotationId : null,
    }));
}

export interface ExistingEnquiry extends EnquiryDetails {
  id: string;
  vendorId: string;
  status: VendorEnquiryStatus;
}

export interface SyncPlan {
  create: DesiredEnquiry[];
  refresh: { id: string; details: EnquiryDetails }[]; // still waiting — the question itself changed
  reopen: { id: string; details: EnquiryDetails }[]; // withdrawn earlier, linked again → asked again
  withdraw: string[]; // no longer linked → nothing more is needed from this vendor
}

const detailsOf = (d: EnquiryDetails): EnquiryDetails => ({
  services: d.services,
  functions: d.functions,
  eventDate: d.eventDate,
  guestCount: d.guestCount,
  city: d.city,
  eventType: d.eventType,
  quotationId: d.quotationId,
});
const sameDetails = (a: EnquiryDetails, b: EnquiryDetails) => JSON.stringify(detailsOf(a)) === JSON.stringify(detailsOf(b));

// Reconcile what should exist with what does. An answered enquiry is never touched by a later save (the vendor's
// answer stands); it is only withdrawn when the vendor is no longer linked at all.
export function planSync(desired: DesiredEnquiry[], existing: ExistingEnquiry[]): SyncPlan {
  const plan: SyncPlan = { create: [], refresh: [], reopen: [], withdraw: [] };
  const wanted = new Map(desired.map((d) => [d.vendorId, d]));
  for (const e of existing) {
    const d = wanted.get(e.vendorId);
    if (!d) {
      if (e.status !== 'WITHDRAWN') plan.withdraw.push(e.id);
      continue;
    }
    if (e.status === 'WITHDRAWN') plan.reopen.push({ id: e.id, details: detailsOf(d) });
    else if (e.status === 'PENDING' && !sameDetails(e, d)) plan.refresh.push({ id: e.id, details: detailsOf(d) });
  }
  const known = new Set(existing.map((e) => e.vendorId));
  for (const d of desired) if (!known.has(d.vendorId)) plan.create.push(d);
  return plan;
}

// ---- what the vendor may see (explicit allow-list — never spread a database row) --------------------------------

export interface VendorEnquiryRow extends ExistingEnquiry {
  responseNote: string | null;
  suggestedDate: string | null;
  quotedAmount: number | null;
  responseChannel: string | null;
  respondedAt: Date | null;
  createdAt: Date;
}

export function toVendorEnquiryView(r: VendorEnquiryRow): VendorEnquiryView {
  return {
    id: r.id,
    services: r.services,
    functions: r.functions,
    eventDate: r.eventDate,
    guestCount: r.guestCount,
    city: r.city,
    eventType: r.eventType,
    status: r.status,
    answer: {
      note: r.responseNote,
      suggestedDate: r.suggestedDate,
      quotedAmount: r.quotedAmount,
      answeredAt: r.respondedAt ? r.respondedAt.toISOString() : null,
      answeredBy: r.responseChannel == null ? null : r.responseChannel === VENDOR_CHANNEL ? 'you' : 'shaadi-shopping',
    },
    askedAt: r.createdAt.toISOString(),
  };
}

// ---- what staff are warned about --------------------------------------------------------------------------------

export function staffAlerts(rows: { vendorName: string; status: VendorEnquiryStatus; suggestedDate: string | null; eventDate: string | null }[]): string[] {
  return rows.flatMap((r) => {
    if (r.status === 'NOT_AVAILABLE') return [`${r.vendorName} is not available${r.eventDate ? ` on ${r.eventDate}` : ''} — replace them on the quote.`];
    if (r.status === 'ALTERNATE_DATE') return [`${r.vendorName} can't do ${r.eventDate ?? 'the date'} but suggests ${r.suggestedDate ?? 'another date'} — check with the customer or replace them.`];
    return [];
  });
}

export function answerSummary(a: Answer): string {
  const parts = [STATUS_LABEL[a.status]];
  if (a.suggestedDate) parts.push(`suggests ${a.suggestedDate}`);
  if (a.quotedAmount != null) parts.push(`₹${a.quotedAmount.toLocaleString('en-IN')}`);
  return parts.join(' — ');
}
