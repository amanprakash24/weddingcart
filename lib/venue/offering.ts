// "What we offer" — a business's ONE price list (the catalog, 7 Oct 2026): everything it sells, sorted by kind — the space and
// things it rents out, food, decoration, services, packages. Each item has a starting price and may say which wedding function it
// is for (Haldi, Reception …); an item with no function is for any of them. One-tap lines in the business's quotation form, and
// what a couple sees when they ask to add a function on their proposal link. Pure and client-safe: the form and the server share
// these rules.
import { FUNCTION_TYPES, FUNCTION_TYPE_LABELS, type FunctionType } from '@/lib/wedding/functions';

export { FUNCTION_TYPES, FUNCTION_TYPE_LABELS, type FunctionType };

// The kinds, in the order they are shown. OTHER is where an item sits until the business sorts it.
export const OFFERING_KINDS = ['RENTAL', 'CATERING', 'DECORATION', 'SERVICE', 'PACKAGE', 'OTHER'] as const;
export type OfferingKind = (typeof OFFERING_KINDS)[number];

export const OFFERING_KIND_LABELS: Record<OfferingKind, string> = {
  RENTAL: 'Venue & rentals',
  CATERING: 'Food & catering',
  DECORATION: 'Decoration',
  SERVICE: 'Services',
  PACKAGE: 'Packages',
  OTHER: 'Other',
};

// What belongs under each kind, in the business's own words — shown where a kind is still empty and as the name box's hint.
export const OFFERING_KIND_EXAMPLES: Record<OfferingKind, string> = {
  RENTAL: 'Banquet hall, lawn, rooms, chairs, generator, cars',
  CATERING: 'Veg plate, non-veg plate, live counter',
  DECORATION: 'Stage, mandap, Haldi theme, entrance',
  SERVICE: 'Photography, DJ, makeup, staff',
  PACKAGE: 'Hall, food and decoration together at one price',
  OTHER: 'Anything that fits nowhere else',
};

// Which kinds a business is shown first, from the category of its listing — a caterer is not asked about halls. Every kind can
// still be chosen when adding; this only decides what the empty screen suggests and the order.
const KINDS_BY_CATEGORY: Record<string, OfferingKind[]> = {
  venue: ['RENTAL', 'CATERING', 'DECORATION', 'SERVICE', 'PACKAGE'],
  accommodation: ['RENTAL', 'CATERING', 'SERVICE', 'PACKAGE'],
  hospitality: ['SERVICE', 'CATERING', 'PACKAGE'],
  catering: ['CATERING', 'PACKAGE', 'SERVICE', 'RENTAL'],
  decorator: ['DECORATION', 'RENTAL', 'PACKAGE', 'SERVICE'],
  sfx: ['DECORATION', 'SERVICE', 'PACKAGE'],
};
const DEFAULT_KINDS: OfferingKind[] = ['SERVICE', 'PACKAGE', 'RENTAL'];

export const kindsForCategory = (categorySlug: string | null | undefined): OfferingKind[] => (categorySlug && KINDS_BY_CATEGORY[categorySlug]) || DEFAULT_KINDS;

export const OFFERING_LIMITS = { nameMax: 120, descriptionMax: 300, maxPrice: 100_000_000, maxPerKind: 60 } as const;

export interface OfferingInput {
  kind: OfferingKind;
  function: FunctionType | null; // null = for any function
  name: string;
  description: string | null; // what is provided — the business's own note
  price: number; // whole rupees — a starting price
  perPlate: boolean; // food and packages only
  active: boolean; // false = kept in the list but not offered on quotations or to couples
}

export interface Offering extends OfferingInput {
  id: string;
}

// A package on the business's public Shaadi Shopping page — managed by Shaadi Shopping, shown in the catalog so there is one
// place to look. `copied` = already in the business's own list.
export interface ListingPackage {
  id: string;
  name: string;
  price: number;
  perPlate: boolean;
  copied: boolean;
}

// The whole "What we offer" screen in one answer.
export interface Catalog {
  items: Offering[];
  kinds: OfferingKind[]; // the kinds to show first for this business
  listingPackages: ListingPackage[];
}

export type OfferingErrors = Partial<Record<'kind' | 'function' | 'name' | 'description' | 'price', string>>;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

export const isFunctionType = (v: unknown): v is FunctionType => (FUNCTION_TYPES as readonly string[]).includes(v as string);
export const isOfferingKind = (v: unknown): v is OfferingKind => (OFFERING_KINDS as readonly string[]).includes(v as string);
export const allowsPerPlate = (kind: OfferingKind) => kind === 'CATERING' || kind === 'PACKAGE';

// Returns the clean offering, or one error per box.
export function validateOffering(input: Record<string, unknown>): { ok: true; value: OfferingInput } | { ok: false; errors: OfferingErrors } {
  const errors: OfferingErrors = {};
  const kind = isOfferingKind(input.kind) ? input.kind : null;
  if (!kind) errors.kind = 'Choose what kind of thing this is';

  // The function is optional: empty = for any function. Anything else must be one from the list.
  const fnRaw = str(input.function);
  const fn = isFunctionType(fnRaw) ? fnRaw : null;
  if (fnRaw && !fn) errors.function = 'Choose the function from the list';

  const name = str(input.name).replace(/\s+/g, ' ');
  if (name.length < 2) errors.name = 'Say what you offer, e.g. Lawn, Haldi decoration, Veg plate';
  else if (name.length > OFFERING_LIMITS.nameMax) errors.name = `Please keep it under ${OFFERING_LIMITS.nameMax} characters`;

  const description = str(input.description).replace(/[ \t]+/g, ' ');
  if (description.length > OFFERING_LIMITS.descriptionMax) errors.description = `Please keep it under ${OFFERING_LIMITS.descriptionMax} characters`;

  const priceRaw = str(input.price).replace(/[₹,\s]/g, '');
  const price = /^\d{1,10}$/.test(priceRaw) ? Number(priceRaw) : null;
  if (price === null || price > OFFERING_LIMITS.maxPrice) errors.price = 'Enter the starting price in whole rupees';

  if (!kind || price === null || Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      kind,
      function: fn,
      name,
      description: description || null,
      price,
      perPlate: allowsPerPlate(kind) && (input.perPlate === true || input.perPlate === 'true'),
      active: !(input.active === false || input.active === 'false'),
    },
  };
}

// Sorted by kind, in the order the kinds are shown; only kinds that have something.
export function groupByKind<T extends { kind: OfferingKind }>(offerings: T[]): { kind: OfferingKind; label: string; items: T[] }[] {
  return OFFERING_KINDS.map((kind) => ({ kind, label: OFFERING_KIND_LABELS[kind], items: offerings.filter((o) => o.kind === kind) })).filter((g) => g.items.length > 0);
}

// What can be added for each function, in the order a wedding runs (Engagement … Reception, Other last). An item with no function
// is for any of them: it appears under every function shown — and when the list has such items, every function is shown.
export function groupOfferings<T extends { function: FunctionType | null }>(offerings: T[]): { function: FunctionType; label: string; items: T[] }[] {
  const general = offerings.filter((o) => o.function === null);
  return FUNCTION_TYPES.map((fn) => ({ function: fn, label: FUNCTION_TYPE_LABELS[fn], items: [...offerings.filter((o) => o.function === fn), ...general] })).filter((g) => g.items.length > 0);
}

export const offeringPriceWords = (o: Pick<OfferingInput, 'price' | 'perPlate'>) => `₹${o.price.toLocaleString('en-IN')}${o.perPlate ? ' per plate' : ''}`;

// The function a quotation line is for: stored on the line as its label ("Haldi"), so the couple's page can group by it.
export const functionOfLabel = (label: string | null | undefined): FunctionType | null => {
  const wanted = label?.trim().toLowerCase();
  return wanted ? (FUNCTION_TYPES.find((fn) => FUNCTION_TYPE_LABELS[fn].toLowerCase() === wanted) ?? null) : null;
};
