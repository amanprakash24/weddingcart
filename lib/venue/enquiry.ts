// A venue's OWN enquiries in Vivah OS (Phase C, docs/wedding-os/15-record-ownership.md §5; audit brief §26). The venue adds an
// enquiry from a phone call, a walk-in, WhatsApp … and the app always says what to do next. Plain words, no CRM terms.
// Pure and client-safe: the form, the list and the server share these rules.

export const CHANNELS = ['PHONE', 'WALK_IN', 'WHATSAPP', 'INSTAGRAM', 'GOOGLE', 'REFERENCE', 'EXISTING_CUSTOMER', 'OTHER'] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<Channel, string> = {
  PHONE: 'Phone call',
  WALK_IN: 'Walk-in',
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  GOOGLE: 'Google',
  REFERENCE: 'Reference',
  EXISTING_CUSTOMER: 'Existing customer',
  OTHER: 'Other',
};

export const NAME_MAX = 80;
export const NEED_MAX = 500;

export interface NewEnquiry {
  name: string;
  phone: string; // 10-digit Indian mobile
  weddingDate: string; // YYYY-MM-DD, or '' when not decided
  guestCount: number; // 0 when not known
  need: string | null;
  channel: Channel;
}

// Returns the clean enquiry, or one error per field — so the phone form can show each message under its own box.
export function validateNewEnquiry(input: Record<string, unknown>, today: string): { ok: true; value: NewEnquiry } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2) errors.name = 'Enter the customer’s name';
  else if (name.length > NAME_MAX) errors.name = `Please keep the name under ${NAME_MAX} characters`;

  const digits = typeof input.phone === 'string' ? input.phone.replace(/\D/g, '') : '';
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) errors.phone = 'Enter a 10-digit mobile number, e.g. 98765 43210';

  const date = typeof input.weddingDate === 'string' ? input.weddingDate.trim() : '';
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.weddingDate = 'Pick the wedding date, or leave it empty';
  else if (date && date < today) errors.weddingDate = 'The wedding date has already passed';

  const rawGuests = input.guestCount;
  const guests = rawGuests === undefined || rawGuests === null || rawGuests === '' ? 0 : Number(rawGuests);
  if (!Number.isInteger(guests) || guests < 0 || guests > 100000) errors.guestCount = 'Enter the number of guests, or leave it empty';

  const need = typeof input.need === 'string' ? input.need.trim() : '';
  if (need.length > NEED_MAX) errors.need = `Please keep this under ${NEED_MAX} characters`;

  const channel = (CHANNELS as readonly string[]).includes(input.channel as string) ? (input.channel as Channel) : null;
  if (!channel) errors.channel = 'Where did this enquiry come from?';

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, phone: local, weddingDate: date, guestCount: guests, need: need || null, channel: channel as Channel } };
}

// ---------- what to do next ----------

import type { QuoteStage } from './quotation';

export interface FollowUp {
  id: string;
  title: string;
  dueAt: string | null;
  done: boolean;
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
