import { FUNCTION_TYPES, FUNCTION_TYPE_LABELS, type FunctionType } from '@/lib/wedding/functions';

// Which wedding function each quotation line belongs to (PR A, 26 Nov 2026). Pure, so the conversion and the tests share it.
//
// A line names its function ("Haldi", "Wedding", or anything else — "Accommodation", "Welcome dinner") and its day. Lines with the
// same function on the same day share one function; an existing function of the wedding with that name and day is reused, never
// duplicated. A line with no function joins the Wedding; a line with no day happens on the wedding day.

export interface LineForFunction {
  key: string; // the quotation line's id
  functionLabel: string | null;
  eventDate: Date | null;
}

export interface ExistingFunction {
  id: string;
  type: string;
  label: string | null;
  date: Date;
}

export interface NewFunction {
  type: FunctionType;
  label: string | null; // only for a name that is not one of the standard functions
  date: Date; // UTC midnight of the India day
}

export type LineTarget = { existingId: string } | { newIndex: number };

// The India day of a stored date — older rows were saved at India midnight, newer ones at UTC midnight.
export function indiaDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

const dayToDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

// "haldi" → Haldi; "Welcome dinner" → Other, named "Welcome dinner"; blank → Wedding.
export function functionOf(label: string | null | undefined): { type: FunctionType; label: string | null } {
  const name = label?.trim().replace(/\s+/g, ' ') ?? '';
  if (!name) return { type: 'WEDDING', label: null };
  const known = FUNCTION_TYPES.find((t) => t !== 'OTHER' && FUNCTION_TYPE_LABELS[t].toLowerCase() === name.toLowerCase());
  return known ? { type: known, label: null } : { type: 'OTHER', label: name };
}

const sameName = (a: { type: string; label: string | null }, b: { type: string; label: string | null }) =>
  a.type === b.type && (a.type !== 'OTHER' || (a.label ?? '').trim().toLowerCase() === (b.label ?? '').trim().toLowerCase());

export function planLineFunctions(lines: LineForFunction[], weddingDate: Date, existing: ExistingFunction[] = []) {
  const created: NewFunction[] = [];
  const targets = new Map<string, LineTarget>();
  for (const line of lines) {
    const fn = functionOf(line.functionLabel);
    const day = indiaDay(line.eventDate ?? weddingDate);
    const found = existing.find((e) => sameName(e, fn) && indiaDay(e.date) === day);
    if (found) {
      targets.set(line.key, { existingId: found.id });
      continue;
    }
    let index = created.findIndex((c) => sameName(c, fn) && indiaDay(c.date) === day);
    if (index === -1) index = created.push({ ...fn, date: dayToDate(day) }) - 1;
    targets.set(line.key, { newIndex: index });
  }
  return { created, targets };
}
