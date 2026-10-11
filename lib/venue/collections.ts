// "Money to collect" — a business's OWN bookings and what each couple still owes (Vendor OS → Payments). Pure and browser-safe:
// no database, no framework. The figures of each booking come from the one Money v1 builder (lib/commercial/view.ts), through
// services/venueCollections.service.ts; this file only adds them up, orders them and words the reminder.

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const istDay = (d: Date | string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(d));
const STRICT_DAY = /^\d{4}-\d{2}-\d{2}$/;

// One booking as the service read it.
export interface CollectionRow {
  enquiryId: string;
  customerName: string;
  phone: string;
  weddingDate: string | null; // YYYY-MM-DD, or anything else / null when the date is not known
  quotationNumber: string;
  weddingId: string | null;
  total: number;
  received: number;
  outstanding: number;
  confirmed: boolean;
  toConfirmRemaining: number;
  stateLabel: string;
  claimsToCheck: number; // "I have paid" from the couple, still to be checked
  payments: { amount: number; paidAt: string }[];
}

export interface CollectionItem extends Omit<CollectionRow, 'payments'> {
  daysToWedding: number | null; // 0 = today, negative = the date has passed, null = no date
}

export interface VenueCollections {
  toCollect: number; // everything still owed, over all bookings
  receivedThisMonth: number; // payments dated this month (India time)
  monthLabel: string; // "October 2026"
  due: CollectionItem[]; // something is still owed — the nearest wedding first
  paidInFull: CollectionItem[];
  businessName: string;
  // The business has its UPI ID in Settings, so the couple's link shows where to pay and "I have paid".
  payOnLink: boolean;
}

const dayNumber = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000;

export function buildCollections(rows: CollectionRow[], now: Date, business: { name: string; payOnLink: boolean }): VenueCollections {
  const today = istDay(now);
  const month = today.slice(0, 7);
  const items = rows.map(({ payments: _payments, ...r }): CollectionItem => {
    const weddingDate = r.weddingDate && STRICT_DAY.test(r.weddingDate) ? r.weddingDate : null;
    return { ...r, weddingDate, daysToWedding: weddingDate ? dayNumber(weddingDate) - dayNumber(today) : null };
  });
  // The nearest date first — a date already passed is the most pressing of all; a booking with no date goes last.
  const byDate = (a: CollectionItem, b: CollectionItem) => (a.daysToWedding ?? Infinity) - (b.daysToWedding ?? Infinity) || a.customerName.localeCompare(b.customerName);
  return {
    toCollect: items.reduce((sum, i) => sum + i.outstanding, 0),
    receivedThisMonth: rows.reduce((sum, r) => sum + r.payments.filter((p) => istDay(p.paidAt).slice(0, 7) === month).reduce((s, p) => s + p.amount, 0), 0),
    monthLabel: new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(now),
    due: items.filter((i) => i.outstanding > 0).sort(byDate),
    paidInFull: items.filter((i) => i.outstanding === 0).sort(byDate),
    businessName: business.name,
    payOnLink: business.payOnLink,
  };
}

export const weddingDayWords = (day: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${day}T12:00:00+05:30`));

export function daysToWeddingWords(days: number | null): string | null {
  if (days === null) return null;
  if (days > 1) return `in ${days} days`;
  if (days === 1) return 'tomorrow';
  if (days === 0) return 'today';
  return 'date has passed';
}

// The reminder the business sends from its OWN WhatsApp. It never carries the couple's link: only the link's hash is stored, so
// the app cannot write it out again — the couple already has it from when the quotation was sent.
export function balanceReminderMessage(i: Pick<CollectionItem, 'customerName' | 'quotationNumber' | 'weddingDate' | 'outstanding' | 'confirmed' | 'toConfirmRemaining'>, from: { businessName: string; payOnLink: boolean }): string {
  const { businessName } = from;
  const what = `your booking with ${businessName}${i.weddingDate ? ` for ${weddingDayWords(i.weddingDate)}` : ''} (quotation ${i.quotationNumber})`;
  const lines = [`Namaste ${i.customerName},`, '', `A gentle reminder about ${what}.`];
  if (!i.confirmed && i.toConfirmRemaining > 0) lines.push(`${inr(i.toConfirmRemaining)} more confirms your booking. In all, ${inr(i.outstanding)} is still to be paid.`);
  else lines.push(`${inr(i.outstanding)} is still to be paid.`);
  if (from.payOnLink) lines.push('', 'You can pay from the link we shared with you — please tap "I have paid" there once it is done.');
  lines.push('', 'Thank you,', businessName);
  return lines.join('\n');
}
