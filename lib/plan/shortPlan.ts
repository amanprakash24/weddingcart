// The short /plan form (25 Oct 2026): what is asked, how it is checked, and what is sent to POST /api/consultations
// (app/api/consultations/schema.ts needs name, phone, weddingDate, days and guestCount). Pure, so it is tested alone.

export interface PlanFields {
  name: string;
  phone: string;
  weddingDate: string; // YYYY-MM-DD from <input type="date">
  guests: string;
  budgetRange: string; // one of BUDGET_OPTIONS ids, or ''
  services: string[];
}

// Same ids the wizard used, so the CRM shows them as before.
export const BUDGET_OPTIONS = [
  { id: 'under-5L', label: 'Under ₹5L' },
  { id: '5-10L', label: '₹5–10L' },
  { id: '10-20L', label: '₹10–20L' },
  { id: '20-50L', label: '₹20–50L' },
  { id: '50L-1Cr', label: '₹50L–1Cr' },
  { id: 'above-1Cr', label: '₹1Cr+' },
] as const;

// Homepage budget links (?budget=…) → the nearest budget option.
export const BUDGET_QUERY_MAP: Record<string, string> = {
  'under-5': 'under-5L',
  '5-10': '5-10L',
  '10-15': '10-20L',
  '15-25': '20-50L',
  '25-plus': '20-50L',
};

export const PLAN_SERVICES = [
  { id: 'venue', label: 'Venue' },
  { id: 'catering', label: 'Catering' },
  { id: 'decorator', label: 'Decor' },
  { id: 'photo-video', label: 'Photo & Video' },
  { id: 'makeup', label: 'Makeup' },
  { id: 'mehndi', label: 'Mehndi' },
  { id: 'band', label: 'Band & DJ' },
  { id: 'planning', label: 'Everything' },
] as const;

/** A 10-digit Indian mobile, typed with or without +91, spaces or dashes; null if it is not one. */
export function planPhoneDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** Problems to show next to each field; an empty object means it can be sent. `today` = YYYY-MM-DD. */
export function checkPlanForm(fields: PlanFields, today: string): Partial<Record<keyof PlanFields, string>> {
  const problems: Partial<Record<keyof PlanFields, string>> = {};
  if (!fields.name.trim()) problems.name = 'Please enter your name.';
  if (!planPhoneDigits(fields.phone)) problems.phone = 'Please enter a 10-digit mobile number.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.weddingDate) || Number.isNaN(new Date(fields.weddingDate).getTime())) problems.weddingDate = 'Please pick your wedding date.';
  else if (fields.weddingDate < today) problems.weddingDate = 'Please pick a date from today onwards.';
  const guests = Number(fields.guests);
  if (!Number.isInteger(guests) || guests < 1) problems.guests = 'Please enter roughly how many guests.';
  else if (guests > 100000) problems.guests = 'Please check the number of guests.';
  return problems;
}

/** The body for POST /api/consultations. Things the short form no longer asks are left for the expert's call. */
export function planPayload(fields: PlanFields, cartItems: unknown[], cartTotal: number) {
  return {
    name: fields.name.trim(),
    phone: planPhoneDigits(fields.phone) ?? fields.phone.trim(),
    city: 'Patna',
    eventType: 'wedding',
    weddingDate: fields.weddingDate,
    days: 1,
    guestCount: Number(fields.guests),
    services: fields.services,
    ...(fields.budgetRange ? { budgetRange: fields.budgetRange } : {}),
    ...(cartItems.length > 0 ? { cartItems, totalBudget: Math.max(0, Math.round(cartTotal)) } : {}),
    message: 'Sent from the short /plan form: days, food, venue type and style to be asked on the call.',
  };
}
