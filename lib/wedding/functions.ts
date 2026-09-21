// Rules for a wedding's functions (Engagement, Haldi, Mehndi, Sangeet, Wedding, Reception, …) — pure, so the service and the tests share them.

export const FUNCTION_TYPES = ['ENGAGEMENT', 'HALDI', 'MEHNDI', 'SANGEET', 'WEDDING', 'RECEPTION', 'OTHER'] as const;
export type FunctionType = (typeof FUNCTION_TYPES)[number];

export const FUNCTION_TYPE_LABELS: Record<FunctionType, string> = {
  ENGAGEMENT: 'Engagement',
  HALDI: 'Haldi',
  MEHNDI: 'Mehndi',
  SANGEET: 'Sangeet',
  WEDDING: 'Wedding',
  RECEPTION: 'Reception',
  OTHER: 'Other',
};

export interface FunctionFields {
  type: FunctionType;
  label?: string | null;
  date: Date;
  startTime?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  city?: string | null;
  budget?: number | null;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const blankToNull = (v: string | null | undefined) => (v === undefined ? undefined : v === null || !v.trim() ? null : v.trim());

// The text checks a function must pass, or the sentence that says what is wrong. `type` and `label` are judged together: an "Other"
// function has no name of its own, so it must be given one.
export function functionProblem(fields: { type: FunctionType; label?: string | null; startTime?: string | null; budget?: number | null; city?: string | null }): string | null {
  if (fields.type === 'OTHER' && !fields.label?.trim()) return 'Give this function a name (for example “Cocktail night”)';
  if (fields.startTime && !TIME.test(fields.startTime)) return 'Start time should look like 18:30';
  if (fields.budget !== undefined && fields.budget !== null && (!Number.isInteger(fields.budget) || fields.budget < 0)) return 'Budget should be a whole number of rupees';
  if (fields.city !== undefined && fields.city !== null && !fields.city.trim()) return 'A function needs a city';
  return null;
}

// The values as they are stored: blank text becomes nothing, and a name only sticks to an "Other" function (a Haldi is just "Haldi").
export function normalizeFunction<T extends Partial<FunctionFields>>(fields: T): T {
  const out = { ...fields } as Record<string, unknown>;
  for (const key of ['label', 'startTime', 'venueName', 'venueAddress'] as const) if (key in out) out[key] = blankToNull(out[key] as string | null | undefined);
  if ('city' in out && typeof out.city === 'string') out.city = out.city.trim();
  if (out.type !== undefined && out.type !== 'OTHER' && 'label' in out) out.label = null;
  return out as T;
}

// Wedding.primaryDate is a cache of the main function's date. Whenever the functions change it follows the earliest "Wedding" function;
// with no "Wedding" function it is left alone (returns null). Compared by day, so an unchanged date is not rewritten.
export function primaryDateFor(events: { type: string; date: Date }[], current: Date): Date | null {
  const main = events.filter((e) => e.type === 'WEDDING').sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  if (!main) return null;
  return main.date.toISOString().slice(0, 10) === current.toISOString().slice(0, 10) ? null : main.date;
}

// Why a function cannot be deleted, or null when it can. Nothing that has history or a promise attached is thrown away with it.
// `vendorBookings` counts the vendors still in play (waiting, confirmed or done) — a declined or cancelled one is no longer a promise.
export function functionDeleteBlocker(facts: { isLastFunction: boolean; vendorBookings: number; servicesWithoutVendor: number; guestReplies: number }): string | null {
  if (facts.isLastFunction) return 'A wedding needs at least one function';
  if (facts.vendorBookings > 0) return `${facts.vendorBookings === 1 ? 'A vendor is' : `${facts.vendorBookings} vendors are`} booked for this function — cancel them first`;
  if (facts.servicesWithoutVendor > 0) return `${facts.servicesWithoutVendor === 1 ? 'A quoted service is' : `${facts.servicesWithoutVendor} quoted services are`} still waiting for a vendor here — assign or remove them first`;
  if (facts.guestReplies > 0) return `Guests have already replied to this function (${facts.guestReplies}) — deleting it would lose those replies`;
  return null;
}

// What a function has committed against its budget: the vendors who are waiting, confirmed or done. A declined or cancelled vendor is not
// a commitment. `over` is how far past the budget it is (0 when within it, or when no budget is set).
export function functionSpend(budget: number | null, bookings: { status: string; agreedPrice: number }[]): { booked: number; over: number } {
  const booked = bookings.filter((b) => b.status === 'PENDING_VENDOR_CONFIRMATION' || b.status === 'CONFIRMED' || b.status === 'COMPLETED').reduce((sum, b) => sum + b.agreedPrice, 0);
  return { booked, over: budget !== null && booked > budget ? booked - budget : 0 };
}
