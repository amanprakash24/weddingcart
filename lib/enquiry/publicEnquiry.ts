// Shared by the public enquiry forms (the 7 Vachan, Swayamvar and Touch of Cozy pages and the portfolio enquiry).
// They used to show "Enquiry received" without looking at the server's answer, so an enquiry the server refused
// (for example with no event date, which POST /api/enquiries requires) was lost while the couple thought it was sent.
// Client-safe: imports nothing that reaches the database.
import { SHAADI_PHONE_DISPLAY } from '@/lib/shaadiContact';

export const DATE_REQUIRED_MESSAGE = 'Please select your event date.';
export const PHONE_INVALID_MESSAGE = 'Please enter a valid 10-digit phone number.';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written YYYY-MM-DD, the same rule app/api/enquiries/schema.ts applies. */
export function isEventDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isTenDigitPhone(value: string): boolean {
  return /^\d{10}$/.test(value.replace(/[\s\-+()]/g, ''));
}

/** The first problem with the form, or null when it may be sent. Phone first, matching the order of the fields. */
export function checkEnquiryForm(form: { phone: string; eventDate: string }): string | null {
  if (!isTenDigitPhone(form.phone)) return PHONE_INVALID_MESSAGE;
  if (!form.eventDate.trim()) return DATE_REQUIRED_MESSAGE;
  if (!isEventDate(form.eventDate.trim())) return DATE_REQUIRED_MESSAGE;
  return null;
}

export type EnquiryResult = { ok: true } | { ok: false; message: string };

const callUs = `Please try again, or call or WhatsApp us on ${SHAADI_PHONE_DISPLAY}.`;

export const ENQUIRY_MESSAGES = {
  rateLimited: `Too many enquiries were sent from this connection. Please wait a few minutes, or call or WhatsApp us on ${SHAADI_PHONE_DISPLAY}.`,
  invalid: `Some details are missing or not valid. Please check the form. ${callUs}`,
  server: `We could not send your enquiry just now. ${callUs}`,
  network: `We could not reach our server. Please check your internet connection. ${callUs}`,
} as const;

/**
 * Sends one enquiry to POST /api/enquiries and reports whether the server accepted it.
 * Success only when the response is 2xx AND the body says { success: true } (the route answers 201 with that).
 */
export async function submitEnquiry(
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<EnquiryResult> {
  let res: Response;
  try {
    res = await fetchImpl('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: ENQUIRY_MESSAGES.network };
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  const success = typeof data === 'object' && data !== null && (data as { success?: unknown }).success === true;
  if (res.ok && success) return { ok: true };

  if (res.status === 429) return { ok: false, message: ENQUIRY_MESSAGES.rateLimited };
  if (res.status >= 400 && res.status < 500) return { ok: false, message: ENQUIRY_MESSAGES.invalid };
  return { ok: false, message: ENQUIRY_MESSAGES.server };
}
