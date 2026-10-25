import { SHAADI_PHONE_DISPLAY } from '@/lib/shaadiContact';

// The "free consultation" pop-up (components/LeadCapturePopup.tsx) sends a mobile number to POST /api/leads.
// It used to show "Thank you" without looking at the answer, so a number the server refused or failed to save was
// lost while the visitor was told it had arrived. Success now means the server said so (201 + success: true).
export type CallbackLeadResult = { ok: true } | { ok: false; error: string };

export const CALLBACK_LEAD_FAILED = `We could not save your number. Please try again, or call us on ${SHAADI_PHONE_DISPLAY}.`;

export function callbackLeadDigits(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export async function submitCallbackLead(
  digits: string,
  whatsapp: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<CallbackLeadResult> {
  try {
    const res = await fetchImpl('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: `+91${digits}`, whatsapp }),
    });
    const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
    if (res.ok && data?.success === true) return { ok: true };
    return { ok: false, error: CALLBACK_LEAD_FAILED };
  } catch {
    return { ok: false, error: CALLBACK_LEAD_FAILED };
  }
}
