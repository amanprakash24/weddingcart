// "Your booking" / "Your wedding" on the couple's link, for a BUSINESS's OWN quotation (a venue's, a vendor's) once the booking is
// made. Pure: services/proposal.service.ts loads the agreement's money and the wedding, this decides what the couple may see.
//
// Read-only for the couple. What is left out on purpose: staff names, internal notes, tasks, payment reference numbers, invoice
// numbers, and anything about another customer. Shaadi Shopping's own links keep their Payments view (lib/payments) instead.
import { computeWeddingStage, type WeddingStage } from '@/lib/wedding/stage';
import { FUNCTION_TYPE_LABELS, type FunctionType } from '@/lib/wedding/functions';

export interface CoupleBooking {
  confirmed: boolean; // the amount to confirm was received
  total: number; // the agreed total
  received: number;
  outstanding: number; // still to pay of the whole total
  toConfirm: number; // still to pay to confirm the booking (0 once confirmed)
  payments: { amount: number; method: string; paidOn: string }[]; // newest first; paidOn = YYYY-MM-DD (IST)
  // The wedding the confirmed booking became. null = not yet.
  wedding: {
    number: string;
    date: string; // YYYY-MM-DD (IST)
    state: 'UPCOMING' | 'COMPLETED' | 'POSTPONED' | 'CANCELLED';
    daysToGo: number | null; // only while UPCOMING; 0 = today; null = the day has passed
    functions: string[]; // "Haldi", "Wedding" … in the wedding's own order, each once
    // Each function with the day, time and place the business has set for it, in date order. `planned` says whether that tells
    // the couple anything more than the names do (some function is on another day, or has a time or a place).
    schedule: { name: string; date: string; time: string | null; place: string | null }[];
    planned: boolean;
  } | null;
}

export interface CoupleBookingMoney {
  agreementTotal: number;
  received: number;
  outstanding: number;
  remaining: number;
  bookingConfirmed: boolean;
  payments: { amount: number; method: string; paidAt: string }[];
}

export interface CoupleBookingWedding {
  weddingNumber: string;
  status: string;
  primaryDate: Date;
  events: { type: string; label: string | null; date: Date; startTime?: string | null; venueName?: string | null }[];
}

const istDay = (d: Date | string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(d));
const METHOD_WORDS: Record<string, string> = { CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'Bank transfer', CHEQUE: 'Cheque', CARD: 'Card', RAZORPAY: 'Online' };
const STATE: Partial<Record<WeddingStage, 'COMPLETED' | 'POSTPONED' | 'CANCELLED'>> = { COMPLETED: 'COMPLETED', POSTPONED: 'POSTPONED', CANCELLED: 'CANCELLED' };

export function toCoupleBooking(money: CoupleBookingMoney, wedding: CoupleBookingWedding | null, now: Date): CoupleBooking {
  let view: CoupleBooking['wedding'] = null;
  if (wedding) {
    // The countdown is to the wedding day itself — the day shown beside it — not to the first function before it.
    const info = computeWeddingStage({ status: wedding.status as never, primaryDate: wedding.primaryDate, now });
    const state = STATE[info.stage] ?? 'UPCOMING';
    const nameOf = (e: { type: string; label: string | null }) => e.label?.trim() || FUNCTION_TYPE_LABELS[e.type as FunctionType] || 'Function';
    const names = wedding.events.map(nameOf);
    const day = istDay(wedding.primaryDate);
    const schedule = wedding.events.map((e) => ({ name: nameOf(e), date: istDay(e.date), time: e.startTime?.trim() || null, place: e.venueName?.trim() || null }));
    view = {
      number: wedding.weddingNumber,
      date: istDay(wedding.primaryDate),
      state,
      daysToGo: state === 'UPCOMING' && info.daysToGo !== null && info.daysToGo >= 0 ? info.daysToGo : null,
      functions: [...new Set(names)],
      schedule,
      planned: schedule.some((f) => f.date !== day || f.time !== null || f.place !== null),
    };
  }
  return {
    confirmed: money.bookingConfirmed,
    total: money.agreementTotal,
    received: money.received,
    outstanding: Math.max(0, money.outstanding),
    toConfirm: money.bookingConfirmed ? 0 : Math.max(0, money.remaining),
    payments: [...money.payments]
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
      .map((p) => ({ amount: p.amount, method: METHOD_WORDS[p.method] ?? 'Payment', paidOn: istDay(p.paidAt) })),
    wedding: view,
  };
}

// The heading of the section and the one line under it — plain words, only facts the booking carries.
export function coupleBookingWords(b: CoupleBooking, businessName: string): { heading: string; line: string } {
  const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const w = b.wedding;
  if (w?.state === 'CANCELLED') return { heading: 'Your wedding', line: `This wedding was cancelled. Please contact ${businessName} if this is not right.` };
  if (w?.state === 'POSTPONED') return { heading: 'Your wedding', line: `This wedding is postponed. ${businessName} will confirm the new date with you.` };
  if (w?.state === 'COMPLETED') return { heading: 'Your wedding', line: `Thank you for celebrating with ${businessName}.` };
  if (w) {
    const days = w.daysToGo === null ? null : w.daysToGo === 0 ? 'Today is the day' : w.daysToGo === 1 ? 'Tomorrow' : `${w.daysToGo} days to go`;
    return { heading: 'Your wedding', line: [days, `Your booking with ${businessName} is confirmed.`].filter(Boolean).join(' · ') };
  }
  if (b.confirmed) return { heading: 'Your booking', line: `Your booking with ${businessName} is confirmed.` };
  return {
    heading: 'Your booking',
    line: b.received > 0
      ? `${rupees(b.received)} received. ${rupees(b.toConfirm)} more confirms your booking with ${businessName}.`
      : `${rupees(b.toConfirm)} confirms your booking with ${businessName}.`,
  };
}
