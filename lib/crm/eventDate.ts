// The wedding date as words ("5 Dec 2026") for customer messages and the quote header — but only when the stored date is an
// exact, real YYYY-MM-DD. Free text ("20 October 20202", "sometime in winter") is never trusted, so nothing wrong is ever
// put in front of a customer; the caller simply leaves the date out.
import { formatQuoteDate } from '@/lib/quotation/message';

const STRICT_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function eventDateWords(raw: string | null | undefined): string | null {
  if (!raw || !STRICT_DATE.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return null; // rejects 2026-02-31 style rollovers
  const year = date.getUTCFullYear();
  if (year < 2000 || year > 2100) return null;
  return formatQuoteDate(date);
}
