// Catering menus (Vivah OS Phase 4, 27 Oct 2026). Founder's rule (6 Oct): "fixed menus + controlled customisation" — the business
// sets up its menus in advance (dishes by course, a price per plate), and a quotation can add ONLY the extras that business made
// available for that menu; "don't turn this into an unrestricted item-by-item restaurant ordering system".
// A menu is a "Food & catering" item in "What we offer" (BusinessOffering kind CATERING) with this menu stored on it.
// Pure and client-safe: the form and the server share these rules.

export const DIETS = ['VEG', 'NON_VEG', 'JAIN', 'MIXED'] as const;
export type Diet = (typeof DIETS)[number];
export const DIET_LABELS: Record<Diet, string> = { VEG: 'Veg', NON_VEG: 'Non-veg', JAIN: 'Jain', MIXED: 'Veg + non-veg' };
export const isDiet = (v: unknown): v is Diet => (DIETS as readonly string[]).includes(v as string);

// Suggested courses, in serving order. A business may type its own.
export const COURSE_SUGGESTIONS = ['Welcome drinks', 'Soups', 'Starters', 'Main course', 'Breads', 'Rice', 'Salads & raita', 'Desserts', 'Live counters', 'Beverages'] as const;

export const MENU_LIMITS = { maxDishes: 80, maxExtras: 20, courseMax: 40, nameMax: 80, maxPrice: 10_000_000, detailsMax: 2000 } as const;

export interface MenuDish {
  course: string; // "Starters"
  name: string; // "Paneer tikka"
}

export interface MenuExtra {
  name: string; // "Live chaat counter"
  price: number; // whole rupees
  perPlate: boolean; // true: × the number of plates; false: one fixed price
}

export interface CateringMenu {
  dishes: MenuDish[];
  extras: MenuExtra[];
}

export const emptyMenu = (): CateringMenu => ({ dishes: [], extras: [] });

export type MenuErrors = Record<string, string>; // "dishes", "dishes.<i>.name", "extras.<i>.price" …

const str = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : typeof v === 'number' ? String(v) : '');

/** Clean the menu from a form or the database. Empty rows (no name) are dropped quietly; anything else wrong is one message per box. */
export function validateMenu(raw: unknown): { ok: true; value: CateringMenu } | { ok: false; errors: MenuErrors } {
  const errors: MenuErrors = {};
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rawDishes = Array.isArray(src.dishes) ? (src.dishes as Record<string, unknown>[]) : [];
  const rawExtras = Array.isArray(src.extras) ? (src.extras as Record<string, unknown>[]) : [];

  const dishes: MenuDish[] = [];
  rawDishes.forEach((d, i) => {
    const name = str(d?.name);
    if (!name) return;
    const course = str(d?.course) || 'Main course';
    if (name.length > MENU_LIMITS.nameMax) errors[`dishes.${i}.name`] = `Please keep it under ${MENU_LIMITS.nameMax} characters`;
    if (course.length > MENU_LIMITS.courseMax) errors[`dishes.${i}.course`] = `Please keep it under ${MENU_LIMITS.courseMax} characters`;
    dishes.push({ course, name });
  });
  if (dishes.length > MENU_LIMITS.maxDishes) errors.dishes = `Please keep it to ${MENU_LIMITS.maxDishes} dishes`;

  const extras: MenuExtra[] = [];
  rawExtras.forEach((x, i) => {
    const name = str(x?.name);
    if (!name) return;
    if (name.length > MENU_LIMITS.nameMax) errors[`extras.${i}.name`] = `Please keep it under ${MENU_LIMITS.nameMax} characters`;
    const priceRaw = str(x?.price).replace(/[₹,\s]/g, '');
    const price = /^\d{1,9}$/.test(priceRaw) ? Number(priceRaw) : null;
    if (price === null || price < 1 || price > MENU_LIMITS.maxPrice) errors[`extras.${i}.price`] = 'Enter the price in whole rupees';
    extras.push({ name, price: price ?? 0, perPlate: !(x?.perPlate === false || x?.perPlate === 'false') });
  });
  if (extras.length > MENU_LIMITS.maxExtras) errors.extras = `Please keep it to ${MENU_LIMITS.maxExtras} extras`;

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { dishes, extras } };
}

/** A stored menu, read back safely (old rows have none; a bad value never breaks a screen). */
export function menuOf(raw: unknown): CateringMenu | null {
  const checked = validateMenu(raw);
  if (!checked.ok) return null;
  return checked.value.dishes.length || checked.value.extras.length ? checked.value : null;
}

/** Dishes grouped by course, in the order the courses first appear. */
export function dishesByCourse(menu: Pick<CateringMenu, 'dishes'>): { course: string; dishes: string[] }[] {
  const groups: { course: string; dishes: string[] }[] = [];
  for (const d of menu.dishes) {
    const g = groups.find((x) => x.course.toLowerCase() === d.course.toLowerCase());
    if (g) g.dishes.push(d.name);
    else groups.push({ course: d.course, dishes: [d.name] });
  }
  return groups;
}

/** The dish list as it is frozen on a quotation line: one line per course ("Starters: Paneer tikka, Hara bhara kabab"). */
export function menuDetails(menu: Pick<CateringMenu, 'dishes'>, diet: Diet | null): string {
  const lines = dishesByCourse(menu).map((g) => `${g.course}: ${g.dishes.join(', ')}`);
  if (diet) lines.unshift(DIET_LABELS[diet]);
  const text = lines.join('\n');
  return text.length > MENU_LIMITS.detailsMax ? `${text.slice(0, MENU_LIMITS.detailsMax - 1)}…` : text;
}

/** How many plates a per-plate line starts with: the enquiry's guest count, else 1 (the business can change it). */
export const platesFor = (guests: number | null | undefined) => (guests && Number.isInteger(guests) && guests > 0 ? Math.min(guests, 100_000) : 1);

/** A quotation line for an extra of a menu — only extras the business listed on that menu can become lines. */
export function extraLine(menuName: string, extra: MenuExtra, guests: number | null | undefined) {
  return {
    description: `${extra.name} (with ${menuName})`.slice(0, 200),
    quantity: extra.perPlate ? platesFor(guests) : 1,
    unitPrice: extra.price,
  };
}

export const extraPriceWords = (x: Pick<MenuExtra, 'price' | 'perPlate'>) => `₹${x.price.toLocaleString('en-IN')}${x.perPlate ? ' per plate' : ''}`;
