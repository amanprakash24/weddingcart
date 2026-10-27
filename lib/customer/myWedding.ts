// My Wedding (the couple's dashboard, 28 Oct 2026): small display rules, pure and client-safe.
import { SHAADI_PHONE } from '@/lib/shaadiContact';

const IST = 'Asia/Kolkata';
const istDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(d); // YYYY-MM-DD

/** Whole days from today (IST) to the wedding day; 0 on the day, negative once it has passed. */
export function daysToGo(weddingDate: string | Date, now: Date = new Date()): number {
  const a = Date.parse(`${istDay(now)}T00:00:00Z`);
  const b = Date.parse(`${istDay(new Date(weddingDate))}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function daysToGoWords(days: number): string {
  if (days > 1) return `${days} days to go`;
  if (days === 1) return 'Tomorrow';
  if (days === 0) return 'Today';
  return 'Celebrated';
}

const WEDDING_STATUS: Record<string, string> = { PLANNING: 'Planning', ACTIVE: 'Planning', POSTPONED: 'Postponed', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
export const weddingStatusWords = (status: string) => WEDDING_STATUS[status] ?? 'Planning';

// A vendor on a function, in the couple's words.
const SERVICE_STATUS: Record<string, { words: string; tone: 'good' | 'wait' | 'off' }> = {
  CONFIRMED: { words: 'Booked', tone: 'good' },
  PENDING_VENDOR_CONFIRMATION: { words: 'Waiting for the vendor', tone: 'wait' },
  CUSTOMER_APPROVAL_PENDING: { words: 'Needs your OK', tone: 'wait' },
  DECLINED: { words: 'Not available', tone: 'off' },
  CANCELLED: { words: 'Cancelled', tone: 'off' },
};
export const serviceStatus = (status: string) => SERVICE_STATUS[status] ?? { words: 'Planning', tone: 'wait' as const };

/** "14 Feb 2027" or "14 – 17 Feb 2027" or "28 Feb – 2 Mar 2027" from the functions' dates (falls back to the main date). */
export function dateRangeWords(dates: string[], fallback: string): string {
  const days = (dates.length ? dates : [fallback]).map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-IN', { ...o, timeZone: IST }).format(d);
  const first = days[0];
  const last = days[days.length - 1];
  if (istDay(first) === istDay(last)) return fmt(first, { day: 'numeric', month: 'short', year: 'numeric' });
  const sameMonth = fmt(first, { month: 'short', year: 'numeric' }) === fmt(last, { month: 'short', year: 'numeric' });
  return sameMonth
    ? `${fmt(first, { day: 'numeric' })} – ${fmt(last, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : `${fmt(first, { day: 'numeric', month: 'short' })} – ${fmt(last, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/** Lakh words for the strip: ₹4.5 lakh, ₹1.2 crore, ₹45,000. */
export function rupeesShort(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(n % 1_00_00_000 === 0 ? 0 : 1)} crore`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(n % 1_00_000 === 0 ? 0 : 1)} lakh`;
  return `₹${n.toLocaleString('en-IN')}`;
}

/** Who the couple calls: the venue / vendor that runs this wedding on Vivah OS (its own number), else Shaadi Shopping. */
export function contactPhone(business: { isShaadiShopping: boolean; phone: string | null }): string {
  const digits = (business.phone ?? '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  return !business.isShaadiShopping && /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : SHAADI_PHONE;
}

export const whatsappTo = (phone: string, message: string) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
