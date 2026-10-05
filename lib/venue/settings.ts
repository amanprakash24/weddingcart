// A venue's own business settings in Vivah OS (Phase C): the number its own couples call, and the rule its own customers book
// under. Pure and client-safe, so the form and the server check the same limits. A blank field means "use the default":
// Shaadi Shopping's rule (lib/commercial/rules.ts) for the percent and the days; the listing's number for the phone.
// A change applies to NEW agreements only — each agreement keeps the rule it was made with (lib/commercial/agreement.ts).

export const SETTINGS_LIMITS = { percentMin: 10, percentMax: 100, daysMin: 1, daysMax: 30 } as const;

export interface VenueSettingsValue {
  contactPhone: string | null; // 10-digit Indian mobile
  confirmationPercent: number | null;
  holdWindowDays: number | null;
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

  if (percent === 'INVALID' || days === 'INVALID' || errors.contactPhone) return { ok: false, errors };
  return { ok: true, value: { contactPhone: phoneRaw ? local : null, confirmationPercent: percent, holdWindowDays: days } };
}
