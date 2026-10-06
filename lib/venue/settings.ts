// A venue's own business settings in Vivah OS (Phase C): the number its own couples call, and the rule its own customers book
// under. Pure and client-safe, so the form and the server check the same limits. A blank field means "use the default":
// Shaadi Shopping's rule (lib/commercial/rules.ts) for the percent and the days; the listing's number for the phone.
// A change applies to NEW agreements only — each agreement keeps the rule it was made with (lib/commercial/agreement.ts).
// The UPI details (D7) are where its own customers pay: the venue shares them itself, with the amount, after a couple accepts.

export const SETTINGS_LIMITS = { percentMin: 10, percentMax: 100, daysMin: 1, daysMax: 30, upiNameMax: 80 } as const;

export interface VenueSettingsValue {
  contactPhone: string | null; // 10-digit Indian mobile
  confirmationPercent: number | null;
  holdWindowDays: number | null;
  upiId: string | null; // name@bank
  upiName: string | null; // the name the customer sees when paying
}

export type SettingsField = keyof VenueSettingsValue;

export type SettingsValidation = { ok: true; value: VenueSettingsValue } | { ok: false; errors: Partial<Record<SettingsField, string>> };

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

function wholeNumber(raw: string, min: number, max: number): number | null | 'INVALID' {
  if (!raw) return null;
  if (!/^\d{1,3}$/.test(raw)) return 'INVALID';
  const n = Number(raw);
  return n >= min && n <= max ? n : 'INVALID';
}

// Returns the clean settings, or one error per field — so the form can show each message under its own box.
export function validateVenueSettings(input: Partial<Record<SettingsField, unknown>>): SettingsValidation {
  const errors: Partial<Record<SettingsField, string>> = {};
  const L = SETTINGS_LIMITS;

  const phoneRaw = text(input.contactPhone);
  const digits = phoneRaw.replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  if (phoneRaw && !/^[6-9]\d{9}$/.test(local)) errors.contactPhone = 'Enter a 10-digit mobile number, e.g. 98765 43210';

  const percent = wholeNumber(text(input.confirmationPercent), L.percentMin, L.percentMax);
  if (percent === 'INVALID') errors.confirmationPercent = `Enter a whole number from ${L.percentMin} to ${L.percentMax}`;
  const days = wholeNumber(text(input.holdWindowDays), L.daysMin, L.daysMax);
  if (days === 'INVALID') errors.holdWindowDays = `Enter a whole number of days from ${L.daysMin} to ${L.daysMax}`;

  const upiId = text(input.upiId).replace(/\s+/g, '');
  if (upiId && !/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/.test(upiId)) errors.upiId = 'Enter the UPI ID as it appears in your payment app, e.g. yourname@okhdfcbank';
  const upiName = text(input.upiName).replace(/\s+/g, ' ');
  if (upiName.length > L.upiNameMax) errors.upiName = `Please keep the name under ${L.upiNameMax} characters`;
  else if (upiName && !upiId) errors.upiName = 'Enter the UPI ID as well, or leave the name empty';

  if (percent === 'INVALID' || days === 'INVALID' || Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { contactPhone: phoneRaw ? local : null, confirmationPercent: percent, holdWindowDays: days, upiId: upiId || null, upiName: upiId ? upiName || null : null } };
}
