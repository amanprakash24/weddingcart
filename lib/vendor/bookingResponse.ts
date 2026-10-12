// A vendor's answer to a Shaadi Shopping booking request, in Vendor OS (12 Oct 2026). When Shaadi Shopping books a vendor for a
// wedding, the booking waits "Awaiting your response"; the vendor confirms it, or says they can't do it and why. Pure and
// browser-safe: the form and the server share these rules.
//
// Only a booking still waiting can be answered. A decline is final for that booking — Shaadi Shopping's team then gives the service
// to someone else (lib/wedding/lifecycle.ts). The couple is never told by the vendor's answer; the team is.

export type BookingAnswer = 'CONFIRM' | 'DECLINE';

export const DECLINE_REASON = { min: 3, max: 300 } as const;

export type ResponseCheck = { ok: true; status: 'CONFIRMED' | 'DECLINED'; reason: string | null } | { ok: false; error: string };

export function checkBookingResponse(input: { answer?: unknown; reason?: unknown }): ResponseCheck {
  if (input.answer === 'CONFIRM') return { ok: true, status: 'CONFIRMED', reason: null };
  if (input.answer !== 'DECLINE') return { ok: false, error: 'Choose Confirm or Can’t do it' };
  const reason = typeof input.reason === 'string' ? input.reason.replace(/\s+/g, ' ').trim() : '';
  if (reason.length < DECLINE_REASON.min) return { ok: false, error: 'Please say why you can’t do it — Shaadi Shopping’s team will find someone else' };
  if (reason.length > DECLINE_REASON.max) return { ok: false, error: `Please keep the reason under ${DECLINE_REASON.max} characters` };
  return { ok: true, status: 'DECLINED', reason };
}
