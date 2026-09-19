// Indian mobile number normalization, shared by the vendor onboarding form
// (client) and POST /api/vendor-applications (server) so both agree on what a
// valid number is.
//
// The form's placeholder invites "+91 98765 43210" but the API historically
// accepted only /^\d{10}$/, so anyone following the placeholder got a generic
// "Invalid request". Normalizing here means people can type the number the way
// they naturally write it; what gets stored (and later used as the vendor's
// OTP-login phone) is always the bare 10 digits, matching /api/otp/send.

export const INDIAN_MOBILE_ERROR = 'Enter a valid 10-digit Indian mobile number, e.g. 98765 43210';

const VALID_MOBILE = /^[6-9]\d{9}$/;

// Returns the bare 10-digit mobile number, or null when the input can't be one.
// Accepted forms: 9876543210, 98765 43210, 98765-43210, +91 98765 43210,
// +919876543210, 919876543210, 09876543210. Indian mobile numbers start 6-9.
export function normalizeIndianMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  let local = digits;
  if (digits.length === 12 && digits.startsWith('91')) local = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) local = digits.slice(1);
  return VALID_MOBILE.test(local) ? local : null;
}
