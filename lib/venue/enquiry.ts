// A venue's OWN enquiries in Vivah OS (Phase C, docs/wedding-os/15-record-ownership.md §5; audit brief §26). The venue adds an
// enquiry from a phone call, a walk-in, WhatsApp … and the app always says what to do next. Plain words, no CRM terms.
// Pure and client-safe: the form, the list and the server share these rules.

export const CHANNELS = ['PHONE', 'WALK_IN', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'GOOGLE', 'WEBSITE', 'REFERENCE', 'EXISTING_CUSTOMER', 'OTHER'] as const;
export type Channel = (typeof CHANNELS)[number];
// Where an enquiry can come from: what the team may pick (CHANNELS), plus SHAADI_SHOPPING — set only when Shaadi Shopping hands an
// enquiry to the venue (services/platformHandoff.service.ts), never picked by hand, so it cannot be claimed without being true.
export type IntakeChannel = Channel | 'SHAADI_SHOPPING';

export const CHANNEL_LABEL: Record<IntakeChannel, string> = {
  PHONE: 'Phone call',
  WALK_IN: 'Walk-in',
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  GOOGLE: 'Google',
  WEBSITE: 'Website',
  REFERENCE: 'Reference',
  EXISTING_CUSTOMER: 'Existing customer',
  OTHER: 'Other',
  SHAADI_SHOPPING: 'Shaadi Shopping',
};

// What they are celebrating (11 Nov 2026, Vivah OS phase 1: every event, not only weddings). The same ids the /plan form uses.
export const EVENT_KINDS = [
  { id: 'wedding', label: 'Wedding' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'birthday', label: 'Birthday' },
  { id: 'anniversary', label: 'Anniversary' },
  { id: 'corporate', label: 'Corporate event' },
  { id: 'other', label: 'Other event' },
] as const;
export type EventKind = (typeof EVENT_KINDS)[number]['id'];
export const eventLabel = (id: string | null | undefined): string => EVENT_KINDS.find((k) => k.id === id?.toLowerCase())?.label ?? 'Wedding';

// The functions of a wedding (asked only for a wedding). The values are the database's WeddingEventType.
export const WEDDING_FUNCTIONS = [
  { id: 'ENGAGEMENT', label: 'Engagement' },
  { id: 'HALDI', label: 'Haldi' },
  { id: 'MEHNDI', label: 'Mehndi' },
  { id: 'SANGEET', label: 'Sangeet' },
  { id: 'WEDDING', label: 'Wedding' },
  { id: 'RECEPTION', label: 'Reception' },
] as const;
export type WeddingFunction = (typeof WEDDING_FUNCTIONS)[number]['id'];
export const functionLabel = (id: string): string => WEDDING_FUNCTIONS.find((f) => f.id === id)?.label ?? id;

export const NAME_MAX = 80;
export const NEED_MAX = 500;
export const DAYS_MAX = 7;
export const BUDGET_MAX = 100_00_00_000; // ₹100 crore — anything above is a typing slip

export interface NewEnquiry {
  name: string;
  phone: string; // 10-digit Indian mobile
  eventType: EventKind;
  weddingDate: string; // YYYY-MM-DD, or '' when not decided (the event's date — the column keeps its older name)
  days: number; // 1 when not said
  functions: WeddingFunction[]; // a wedding's functions; always empty for other events
  guestCount: number; // 0 when not known
  budget: number | null; // whole rupees, when they said
  need: string | null;
  channel: IntakeChannel;
}

// "5,00,000", "₹ 500000", 500000 → 500000; '' → null; anything else → NaN.
function rupees(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return Number.NaN;
  const clean = raw.replace(/[₹,\s]/g, '');
  return clean === '' ? null : /^\d+$/.test(clean) ? Number(clean) : Number.NaN;
}

// Returns the clean enquiry, or one error per field — so the phone form can show each message under its own box. The same rules
// for the venue's team ("+ New Enquiry") and for the couple on the venue's enquiry page.
export function validateNewEnquiry(input: Record<string, unknown>, today: string): { ok: true; value: NewEnquiry } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2) errors.name = 'Enter the name';
  else if (name.length > NAME_MAX) errors.name = `Please keep the name under ${NAME_MAX} characters`;

  const digits = typeof input.phone === 'string' ? input.phone.replace(/\D/g, '') : '';
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) errors.phone = 'Enter a 10-digit mobile number, e.g. 98765 43210';

  // Not sent (an older form) = a wedding, as every enquiry was before.
  const rawKind = input.eventType === undefined || input.eventType === null || input.eventType === '' ? 'wedding' : input.eventType;
  const eventType = EVENT_KINDS.find((k) => k.id === rawKind)?.id ?? null;
  if (!eventType) errors.eventType = 'Choose what they are celebrating';

  const date = typeof input.weddingDate === 'string' ? input.weddingDate.trim() : '';
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.weddingDate = 'Pick the date, or leave it empty';
  else if (date && date < today) errors.weddingDate = 'That date has already passed';

  const rawDays = input.days;
  const days = rawDays === undefined || rawDays === null || rawDays === '' ? 1 : Number(rawDays);
  if (!Number.isInteger(days) || days < 1 || days > DAYS_MAX) errors.days = `Choose 1 to ${DAYS_MAX} days`;

  const picked = Array.isArray(input.functions) ? input.functions : [];
  const known = new Set<string>(WEDDING_FUNCTIONS.map((f) => f.id));
  if (picked.some((f) => typeof f !== 'string' || !known.has(f))) errors.functions = 'Choose the functions from the list';
  // In the list's order, once each; only a wedding has them.
  const functions = eventType === 'wedding' ? WEDDING_FUNCTIONS.map((f) => f.id).filter((id) => picked.includes(id)) : [];

  const rawGuests = input.guestCount;
  const guests = rawGuests === undefined || rawGuests === null || rawGuests === '' ? 0 : Number(rawGuests);
  if (!Number.isInteger(guests) || guests < 0 || guests > 100000) errors.guestCount = 'Enter the number of guests, or leave it empty';

  const budget = rupees(input.budget);
  if (budget !== null && (!Number.isInteger(budget) || budget <= 0 || budget > BUDGET_MAX)) errors.budget = 'Enter the budget in rupees, or leave it empty';

  const need = typeof input.need === 'string' ? input.need.trim() : '';
  if (need.length > NEED_MAX) errors.need = `Please keep this under ${NEED_MAX} characters`;

  const channel = (CHANNELS as readonly string[]).includes(input.channel as string) ? (input.channel as Channel) : null;
  if (!channel) errors.channel = 'Where did this enquiry come from?';

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { name, phone: local, eventType: eventType as EventKind, weddingDate: date, days, functions, guestCount: guests, budget, need: need || null, channel: channel as Channel },
  };
}

// ---------- the venue's own enquiry page (11 Nov 2026) ----------

// Where the venue puts its link. `src` is added to the link so each enquiry records where it came from without anyone typing it.
export const ENQUIRY_PAGE_PLACES = [
  { src: 'website', label: 'Your website', channel: 'WEBSITE' },
  { src: 'google', label: 'Google Business Profile', channel: 'GOOGLE' },
  { src: 'instagram', label: 'Instagram bio', channel: 'INSTAGRAM' },
  { src: 'facebook', label: 'Facebook page', channel: 'FACEBOOK' },
  { src: 'whatsapp', label: 'WhatsApp (status, replies)', channel: 'WHATSAPP' },
] as const satisfies readonly { src: string; label: string; channel: Channel }[];

export const ENQUIRY_PAGE_SOURCE = 'Enquiry page';

// The channel an enquiry from the page is recorded under: from its link's `src`; a link without one (shared some other way) = Other.
export function pageChannel(src: unknown): Channel {
  return ENQUIRY_PAGE_PLACES.find((p) => p.src === (typeof src === 'string' ? src.trim().toLowerCase() : ''))?.channel ?? 'OTHER';
}

// A form sent by a program, not a person: the hidden box (people never see it, so never fill it) has text, or it came back faster
// than anyone can type. Such a form is answered like any other and quietly not saved. `openMs` is how long the form was open, measured
// on the phone itself — never the phone's clock against the server's, which a wrong phone clock would turn into a lost enquiry.
export const MIN_FILL_MS = 3000;
export function looksAutomated(input: { trap?: unknown; openMs?: unknown }): boolean {
  if (typeof input.trap === 'string' && input.trap.trim() !== '') return true;
  const open = typeof input.openMs === 'number' ? input.openMs : Number(input.openMs);
  return !Number.isFinite(open) || open < MIN_FILL_MS;
}

// "Google · Enquiry page" — where an enquiry came from, as the venue's list shows it.
export function sourceLabel(channel: string | null | undefined, sourceDetail: string | null | undefined): string {
  const base = CHANNEL_LABEL[channel as IntakeChannel] ?? 'Shaadi Shopping';
  return sourceDetail ? `${base} · ${sourceDetail}` : base;
}

// ---------- what to do next ----------

import type { QuoteStage } from './quotation';

export interface FollowUp {
  id: string;
  title: string;
  dueAt: string | null;
  done: boolean;
  assignee?: { id: string; name: string } | null; // who it was given to (13 Oct 2026); nobody = anyone who works the enquiries
}

export type NextAction =
  | { kind: 'PAYMENT_TO_CHECK'; label: string } // the couple said "I have paid" on their link — look in the bank, then say so
  | { kind: 'CALL'; label: string } // nobody has spoken to them yet
  | { kind: 'FOLLOW_UP_OVERDUE'; label: string; followUpId: string }
  | { kind: 'FOLLOW_UP_TODAY'; label: string; followUpId: string }
  | { kind: 'FOLLOW_UP_LATER'; label: string; followUpId: string }
  | { kind: 'SCHEDULE'; label: string } // spoken to, nothing planned
  // The venue's own quotation for this enquiry (lib/venue/quotation.ts):
  | { kind: 'BOOKED'; label: string } // the amount to confirm was received — the booking is confirmed
  | { kind: 'QUOTE_ACCEPTED'; label: string } // the couple said yes; the amount to confirm is still to come
  | { kind: 'QUOTE_CHANGES'; label: string } // the couple asked for changes
  | { kind: 'QUOTE_DRAFT'; label: string } // written, not sent
  | { kind: 'QUOTE_WAITING'; label: string } // sent, the couple has not answered
  | { kind: 'CLOSED'; label: string };

const istDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
const dayWords = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
const firstName = (name: string) => name.split(' ')[0];

// One primary action per enquiry (audit brief §13): the earliest open follow-up decides; with none, call them if nobody has yet,
// otherwise plan the next step. A quotation changes it: the couple's answer (yes / changes) comes before everything; a draft waits
// to be sent and a sent one waits for the couple — but a follow-up that is due is still shown first.
export function nextAction(e: { name: string; contacted: boolean; closed: boolean; followUps: FollowUp[]; quote?: QuoteStage | null; booked?: boolean; paymentToCheck?: boolean }, now: Date = new Date()): NextAction {
  const who = firstName(e.name);
  if (e.closed) return { kind: 'CLOSED', label: 'Closed' };
  if (e.quote === 'ACCEPTED' && e.paymentToCheck) return { kind: 'PAYMENT_TO_CHECK', label: `${who} says they have paid — check and confirm it` };
  if (e.quote === 'ACCEPTED' && e.booked) return { kind: 'BOOKED', label: `Booking confirmed for ${who}` };
  if (e.quote === 'ACCEPTED') return { kind: 'QUOTE_ACCEPTED', label: `${who} accepted your quotation` };
  if (e.quote === 'CHANGES') return { kind: 'QUOTE_CHANGES', label: `${who} asked for changes to the quotation` };
  const open = e.followUps.filter((f) => !f.done).sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'));
  const next = open[0];
  if (next) {
    const today = istDay(now);
    const due = next.dueAt ? istDay(new Date(next.dueAt)) : null;
    if (due && due < today) return { kind: 'FOLLOW_UP_OVERDUE', label: `Follow up with ${who} — was due ${dayWords(next.dueAt as string)}`, followUpId: next.id };
    if (due === today) return { kind: 'FOLLOW_UP_TODAY', label: `Follow up with ${who} today`, followUpId: next.id };
    return { kind: 'FOLLOW_UP_LATER', label: next.dueAt ? `Follow up with ${who} on ${dayWords(next.dueAt)}` : `Follow up with ${who}`, followUpId: next.id };
  }
  if (e.quote === 'DRAFT') return { kind: 'QUOTE_DRAFT', label: `Finish and send the quotation to ${who}` };
  if (e.quote === 'SENT') return { kind: 'QUOTE_WAITING', label: `Waiting for ${who} to answer the quotation` };
  if (!e.contacted) return { kind: 'CALL', label: `Call ${who}` };
  return { kind: 'SCHEDULE', label: `Plan the next step with ${who}` };
}

// "Today's Work" order: the couple's answer first, then what is late, then today, then the rest.
export const ACTION_ORDER: NextAction['kind'][] = ['PAYMENT_TO_CHECK', 'QUOTE_ACCEPTED', 'QUOTE_CHANGES', 'FOLLOW_UP_OVERDUE', 'CALL', 'FOLLOW_UP_TODAY', 'QUOTE_DRAFT', 'SCHEDULE', 'QUOTE_WAITING', 'FOLLOW_UP_LATER', 'BOOKED', 'CLOSED'];

// Opens a chat with the venue's OWN customer, from the venue's own tool. (Public marketplace pages are different: there every
// contact link must be Shaadi Shopping's number, never a venue's.)
export const whatsappTo = (phone: string, text: string) => `https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(text)}`;

// History lines that say what has been paid or invoiced. A member without `view_financials` (a manager, by default) does not get
// them from the server — the same rule as the payments on the quotation (services/venueQuotation.service.ts `moneyHidden`).
export const MONEY_HISTORY_TYPES: readonly string[] = ['PAYMENT_RECEIVED', 'INVOICE_CREATED', 'PAYMENT_SUBMITTED', 'PAYMENT_SUBMISSION_REJECTED'];

export function historyFor<T extends { type: string }>(history: T[], seesMoney: boolean): T[] {
  return seesMoney ? history : history.filter((h) => !MONEY_HISTORY_TYPES.includes(h.type));
}
