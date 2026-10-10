// What a business types on its own wedding's page: a function (which one, its day, time and place) and a to-do. Pure: the checks
// here turn the form into the values the existing wedding services take (services/weddingWorkspace.service.ts — unchanged rules:
// an "Other" function needs a name, the wedding's date follows its "Wedding" function, only an empty function can be removed).
import { dayRange } from '@/lib/venue/sameDate';
import { FUNCTION_TYPES, type FunctionType } from '@/lib/wedding/functions';

export const WEDDING_PLAN_LIMITS = { nameMax: 80, placeMax: 160, taskMax: 200 } as const;

export interface FunctionForm {
  type: FunctionType;
  label: string | null; // the name of an "Other" function; null for the named ones
  date: Date; // the start of that day (the same way a wedding date is stored)
  startTime: string | null; // "18:30"
  venueName: string | null; // where: "Main lawn", "Banquet hall" …
}

export type FunctionErrors = Partial<Record<'type' | 'label' | 'date' | 'startTime' | 'place', string>>;
export type TaskErrors = Partial<Record<'title' | 'dueOn', string>>;

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
// A real YYYY-MM-DD in a believable year, as the start of that day — the way a wedding date is stored (lib/quotation/booking.ts).
// Kept free of server-only imports: the wedding page in the browser uses this file's limits.
function dayOf(raw: string): Date | null {
  const day = dayRange(raw)?.gte ?? null;
  return day && day.getUTCFullYear() >= 2020 && day.getUTCFullYear() <= 2100 ? day : null;
}
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateFunctionForm(input: Record<string, unknown>): { ok: true; value: FunctionForm } | { ok: false; errors: FunctionErrors } {
  const errors: FunctionErrors = {};
  const type = (FUNCTION_TYPES as readonly string[]).includes(input.type as string) ? (input.type as FunctionType) : null;
  if (!type) errors.type = 'Choose the function';
  const label = text(input.label);
  if (type === 'OTHER' && !label) errors.label = 'Give this function a name';
  else if (label.length > WEDDING_PLAN_LIMITS.nameMax) errors.label = `Please keep the name under ${WEDDING_PLAN_LIMITS.nameMax} letters`;
  const date = dayOf(text(input.date));
  if (!date) errors.date = 'Pick the day';
  const startTime = text(input.startTime);
  if (startTime && !TIME.test(startTime)) errors.startTime = 'Time should look like 18:30';
  const place = text(input.place);
  if (place.length > WEDDING_PLAN_LIMITS.placeMax) errors.place = `Please keep the place under ${WEDDING_PLAN_LIMITS.placeMax} letters`;
  if (Object.keys(errors).length > 0 || !type || !date) return { ok: false, errors };
  return { ok: true, value: { type, label: type === 'OTHER' ? label : null, date, startTime: startTime || null, venueName: place || null } };
}

// A to-do: what, and (if they want) by when. The day is kept at noon in India, so it reads as the same day everywhere.
export function validateTaskForm(input: Record<string, unknown>): { ok: true; value: { title: string; dueAt: Date | null } } | { ok: false; errors: TaskErrors } {
  const errors: TaskErrors = {};
  const title = text(input.title);
  if (!title) errors.title = 'Write what needs doing';
  else if (title.length > WEDDING_PLAN_LIMITS.taskMax) errors.title = `Please keep it under ${WEDDING_PLAN_LIMITS.taskMax} letters`;
  const dueOn = text(input.dueOn);
  if (dueOn && !dayOf(dueOn)) errors.dueOn = 'Pick the day, or leave it empty';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { title, dueAt: dueOn ? new Date(`${dueOn}T12:00:00+05:30`) : null } };
}
