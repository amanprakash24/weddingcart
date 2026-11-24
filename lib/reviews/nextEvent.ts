import { EVENT_KINDS } from '@/lib/venue/enquiry';

// "This is not goodbye" on /review (24 Nov 2026): a family tells us about their next celebration, or refers a relative or friend.
// Both become a consultation in the CRM (source "review-page") for the team to call. Pure rules shared by the API, page and tests.

// The returning-family offer, written once. The founder will send the terms; until then the page says they apply and are with the
// Wedding Expert — nothing else is promised.
export const RETURNING_OFFER = {
  headline: '10% off your next event with us',
  short: '10% off',
  terms: null as string | null, // the founder's terms and conditions, when shared
  termsNote: 'Terms & conditions apply — your Wedding Expert will share them.',
};

export const NEXT_EVENT_KINDS = EVENT_KINDS.filter((k) => k.id !== 'corporate');
export type NextEventKind = (typeof NEXT_EVENT_KINDS)[number]['id'];

export interface NextEventInput {
  kind: unknown; // 'NEXT' (our own next event) | 'REFERRAL' (someone we know)
  name: unknown;
  phone: unknown;
  eventType: unknown;
  month?: unknown; // YYYY-MM, optional
  note?: unknown;
  referrerName?: unknown; // REFERRAL: who is referring
  referrerPhone?: unknown;
  website?: unknown; // honeypot
}

export interface CleanNextEvent {
  kind: 'NEXT' | 'REFERRAL';
  name: string;
  phone: string;
  eventType: NextEventKind;
  month: string | null;
  note: string | null;
  referrerName: string | null;
  referrerPhone: string | null;
}

const text = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
function mobile(v: unknown): string | null | undefined {
  const raw = text(v);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '').replace(/^(?:91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : undefined;
}

export const nextEventIsBot = (input: NextEventInput) => text(input.website) !== '';

export function checkNextEvent(input: NextEventInput, today: string): { ok: true; value: CleanNextEvent } | { ok: false; error: string } {
  const kind = input.kind === 'REFERRAL' ? 'REFERRAL' : input.kind === 'NEXT' ? 'NEXT' : null;
  if (!kind) return { ok: false, error: 'Please try again' };
  const eventType = NEXT_EVENT_KINDS.find((k) => k.id === input.eventType)?.id;
  if (!eventType) return { ok: false, error: 'Choose the celebration' };
  const name = text(input.name);
  if (name.length < 2) return { ok: false, error: kind === 'REFERRAL' ? 'Add their name' : 'Add your name' };
  if (name.length > 60) return { ok: false, error: 'Keep the name under 60 characters' };
  const phone = mobile(input.phone);
  if (!phone) return { ok: false, error: kind === 'REFERRAL' ? 'Their mobile should be a 10-digit number' : 'Your mobile should be a 10-digit number' };
  const month = text(input.month);
  if (month && (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < today.slice(0, 7))) return { ok: false, error: 'Choose a month from now on (or leave it empty)' };
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > 500) return { ok: false, error: 'Keep the note under 500 characters' };
  let referrerName: string | null = null;
  let referrerPhone: string | null = null;
  if (kind === 'REFERRAL') {
    referrerName = text(input.referrerName);
    if (referrerName.length < 2) return { ok: false, error: 'Add your name, so we can thank you' };
    if (referrerName.length > 60) return { ok: false, error: 'Keep your name under 60 characters' };
    const rp = mobile(input.referrerPhone);
    if (rp === undefined) return { ok: false, error: 'Your mobile should be a 10-digit number (or leave it empty)' };
    referrerPhone = rp;
    if (referrerPhone && referrerPhone === phone) return { ok: false, error: 'That is your own number — add theirs' };
  }
  return { ok: true, value: { kind, name, phone, eventType, month: month || null, note: note || null, referrerName, referrerPhone } };
}

const monthWords = (m: string) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-01T00:00:00Z`));

// The CRM record the team sees (a Shaadi Shopping consultation). Date unknown = '' (the CRM's "not decided yet").
export function consultationFromNextEvent(e: CleanNextEvent) {
  const event = NEXT_EVENT_KINDS.find((k) => k.id === e.eventType)!.label;
  const lines = [
    e.kind === 'NEXT' ? `Returning family — told us about their next celebration on the review page.` : `Referred by ${e.referrerName}${e.referrerPhone ? ` (+91 ${e.referrerPhone})` : ''} from the review page.`,
    `${event}${e.month ? `, around ${monthWords(e.month)}` : ''}.`,
    e.kind === 'NEXT' ? `Returning-family offer shown: ${RETURNING_OFFER.headline} (T&C apply).` : null,
    e.note ? `Note: ${e.note}` : null,
  ].filter(Boolean);
  return {
    name: e.name,
    phone: e.phone,
    city: 'Patna',
    eventType: e.eventType,
    weddingDate: '',
    days: 1,
    guestCount: 0,
    message: lines.join(' '),
    channel: e.kind === 'NEXT' ? 'EXISTING_CUSTOMER' : 'REFERENCE', // the CRM's own channel words
    sourceDetail: e.kind === 'NEXT' ? 'Review page · our next celebration' : `Review page · referral from ${e.referrerName}`,
  };
}
