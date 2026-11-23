import { FUNCTION_TYPES, FUNCTION_TYPE_LABELS, type FunctionType } from '@/lib/wedding/functions';

// Couple-controlled functions (22 Nov 2026, Client OS) — pure rules shared by the service, the API and My Wedding.
//
//   - A couple adds and edits every function (23 Nov 2026), the Wedding included. Their own stand as they save them; an edit of a
//     planner-set function, or of the confirmed Wedding, is a REQUEST (pendingChange): nothing moves until staff confirm it.
//   - There is one Wedding function; a couple can add it only if the wedding has none, and it waits for staff.
//   - A function at the booked venue (or in one of the venue's own spaces) affects the booking, so it is WAITING until authorised staff
//     confirm it. A function somewhere else stands at once.
//   - Nothing here changes the venue booking, a hall hold, availability or the agreed price — confirmation is a person's decision.

export const COUPLE_FUNCTION_TYPES = [...FUNCTION_TYPES];
export type CoupleFunctionType = (typeof COUPLE_FUNCTION_TYPES)[number];
export type FunctionPlace = 'BOOKED_VENUE' | 'ELSEWHERE';

export interface CoupleFunctionInput {
  type: string;
  name?: string | null; // required for "Other"; optional own name otherwise ("Mehndi at Nani's")
  date: string; // YYYY-MM-DD
  startTime?: string | null;
  endTime?: string | null;
  place: FunctionPlace;
  venueSpaceId?: string | null; // a venue's own hall, only with BOOKED_VENUE
  venueName?: string | null; // only with ELSEWHERE
  venueAddress?: string | null;
  description?: string | null;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const isCalendarDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const tooLong = (v: string | null | undefined, max: number) => !!v && v.trim().length > max;

// The first thing wrong with what the couple typed, in words they can act on — or null.
export function coupleFunctionProblem(input: CoupleFunctionInput, today: string): string | null {
  if (!(COUPLE_FUNCTION_TYPES as string[]).includes(input.type)) return 'Choose what kind of function it is';
  if (input.type === 'OTHER' && !input.name?.trim()) return 'Give this function a name (for example “Cocktail night”)';
  if (tooLong(input.name, 80)) return 'Keep the name under 80 characters';
  if (!isCalendarDate(input.date)) return 'Choose the date';
  if (input.date < today) return 'The date has already passed';
  if (input.startTime && !TIME.test(input.startTime)) return 'Start time should look like 18:30';
  if (input.endTime && !TIME.test(input.endTime)) return 'End time should look like 22:30';
  if (input.endTime && !input.startTime) return 'Add a start time too';
  if (input.startTime && input.endTime && input.startTime === input.endTime) return 'The end time is the same as the start time';
  if (input.place !== 'BOOKED_VENUE' && input.place !== 'ELSEWHERE') return 'Say where it is';
  if (input.place === 'ELSEWHERE' && input.type !== 'WEDDING' && !input.venueName?.trim()) return 'Say where it is (for example “Home” or the place’s name)';
  if (tooLong(input.venueName, 160)) return 'Keep the place’s name under 160 characters';
  if (tooLong(input.venueAddress, 300)) return 'Keep the address under 300 characters';
  if (tooLong(input.description, 500)) return 'Keep the description under 500 characters';
  return null;
}

// A function at the booked venue (in any of its spaces) touches the booking — it waits for staff. Anywhere else stands at once.
// A venue space can only be chosen with the booked venue, so the place alone decides.
export function needsConfirmation(input: Pick<CoupleFunctionInput, 'place' | 'type'>): boolean {
  return input.place === 'BOOKED_VENUE' || input.type === 'WEDDING';
}

// What is stored for a couple's function (blank → null; a name sticks; place decides venue fields).
export function coupleFunctionFields(input: CoupleFunctionInput) {
  const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  const atVenue = input.place === 'BOOKED_VENUE';
  return {
    type: input.type as CoupleFunctionType,
    label: clean(input.name),
    date: new Date(`${input.date}T00:00:00Z`),
    startTime: clean(input.startTime),
    endTime: clean(input.endTime),
    atBookedVenue: atVenue,
    venueSpaceId: atVenue ? clean(input.venueSpaceId) : null,
    venueName: atVenue ? null : clean(input.venueName),
    venueAddress: atVenue ? null : clean(input.venueAddress),
    description: clean(input.description),
    confirmation: needsConfirmation(input) ? ('WAITING' as const) : ('CONFIRMED' as const),
  };
}

// What a couple may remove: only functions they added, and never a Wedding staff have confirmed.
export function coupleMayChange(event: { addedByCouple: boolean; type?: string; confirmation?: string }): boolean {
  return event.addedByCouple && !(event.type === 'WEDDING' && event.confirmation === 'CONFIRMED');
}

// An edit that must not take effect until staff confirm it: a planner-set function, or the confirmed Wedding.
export function changeNeedsApproval(event: { addedByCouple: boolean; type: string; confirmation: string }): boolean {
  return !event.addedByCouple || (event.type === 'WEDDING' && event.confirmation === 'CONFIRMED');
}

// The Wedding stays the Wedding, and nothing else becomes a second one.
export function typeChangeProblem(currentType: string, nextType: string): string | null {
  if (currentType === nextType) return null;
  return currentType === 'WEDDING' || nextType === 'WEDDING' ? 'The Wedding function cannot be changed to another kind of function' : null;
}

export interface PendingFunctionChange {
  type: string;
  label: string | null;
  date: string; // YYYY-MM-DD
  startTime: string | null;
  endTime: string | null;
  atBookedVenue: boolean;
  venueSpaceId: string | null;
  venueName: string | null;
  venueAddress: string | null;
  description: string | null;
}

export function pendingFromFields(f: ReturnType<typeof coupleFunctionFields>): PendingFunctionChange {
  return { type: f.type, label: f.label, date: f.date.toISOString().slice(0, 10), startTime: f.startTime, endTime: f.endTime, atBookedVenue: f.atBookedVenue, venueSpaceId: f.venueSpaceId, venueName: f.venueName, venueAddress: f.venueAddress, description: f.description };
}

// True when the requested edit is what the function already says (the India date: old rows may be stored at IST midnight).
export function sameAsCurrent(e: Omit<PendingFunctionChange, 'date'> & { date: Date }, p: PendingFunctionChange): boolean {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(e.date);
  return day === p.date && e.type === p.type && (e.label ?? null) === p.label && (e.startTime ?? null) === p.startTime && (e.endTime ?? null) === p.endTime && e.atBookedVenue === p.atBookedVenue && (e.venueSpaceId ?? null) === p.venueSpaceId && (e.venueName ?? null) === p.venueName && (e.venueAddress ?? null) === p.venueAddress && (e.description ?? null) === p.description;
}

export function functionDisplayName(e: { type: string; label: string | null }): string {
  return e.label?.trim() || FUNCTION_TYPE_LABELS[e.type as FunctionType] || 'Function';
}
