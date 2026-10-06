// What a venue offers for each wedding function (Phase C): Haldi → lawn, decoration, veg plate …, each with a starting price.
// The venue's own price list for the customers it brings itself: one-tap lines in its quotation form, and what a couple sees when
// they ask to add a function on their proposal link. Pure and client-safe: the form and the server share these rules.
import { FUNCTION_TYPES, FUNCTION_TYPE_LABELS, type FunctionType } from '@/lib/wedding/functions';

export { FUNCTION_TYPES, FUNCTION_TYPE_LABELS, type FunctionType };

export const OFFERING_LIMITS = { nameMax: 120, maxPrice: 100_000_000, maxPerFunction: 40 } as const;

export interface OfferingInput {
  function: FunctionType;
  name: string;
  price: number; // whole rupees — a starting price
  perPlate: boolean;
}

export interface Offering extends OfferingInput {
  id: string;
}

export type OfferingErrors = Partial<Record<'function' | 'name' | 'price', string>>;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

export const isFunctionType = (v: unknown): v is FunctionType => (FUNCTION_TYPES as readonly string[]).includes(v as string);

// Returns the clean offering, or one error per box.
export function validateOffering(input: Record<string, unknown>): { ok: true; value: OfferingInput } | { ok: false; errors: OfferingErrors } {
  const errors: OfferingErrors = {};
  const fn = isFunctionType(input.function) ? input.function : null;
  if (!fn) errors.function = 'Choose the function this is for';

  const name = str(input.name).replace(/\s+/g, ' ');
  if (name.length < 2) errors.name = 'Say what you offer, e.g. Lawn, Haldi decoration, Veg plate';
  else if (name.length > OFFERING_LIMITS.nameMax) errors.name = `Please keep it under ${OFFERING_LIMITS.nameMax} characters`;

  const priceRaw = str(input.price).replace(/[₹,\s]/g, '');
  const price = /^\d{1,10}$/.test(priceRaw) ? Number(priceRaw) : null;
  if (price === null || price > OFFERING_LIMITS.maxPrice) errors.price = 'Enter the starting price in whole rupees';

  if (!fn || price === null || Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { function: fn, name, price, perPlate: input.perPlate === true || input.perPlate === 'true' } };
}

// Grouped in the order a wedding runs (Engagement … Reception, Other last); only functions that have something.
export function groupOfferings<T extends { function: FunctionType }>(offerings: T[]): { function: FunctionType; label: string; items: T[] }[] {
  return FUNCTION_TYPES.map((fn) => ({ function: fn, label: FUNCTION_TYPE_LABELS[fn], items: offerings.filter((o) => o.function === fn) })).filter((g) => g.items.length > 0);
}

export const offeringPriceWords = (o: Pick<OfferingInput, 'price' | 'perPlate'>) => `₹${o.price.toLocaleString('en-IN')}${o.perPlate ? ' per plate' : ''}`;

// The function a quotation line is for: stored on the line as its label ("Haldi"), so the couple's page can group by it.
export const functionOfLabel = (label: string | null | undefined): FunctionType | null => {
  const wanted = label?.trim().toLowerCase();
  return wanted ? (FUNCTION_TYPES.find((fn) => FUNCTION_TYPE_LABELS[fn].toLowerCase() === wanted) ?? null) : null;
};
