import { FUNCTION_TYPES, FUNCTION_TYPE_LABELS, type FunctionType } from '@/lib/wedding/functions';

// Couple-controlled functions (22 Nov 2026, Client OS) — pure rules shared by the service, the API and My Wedding.
//
//   - A couple adds and edits their OWN functions (Haldi at home, Mehndi, Sangeet …). Staff-made functions are read-only to them.
//   - A couple never adds a "Wedding" function: the main function belongs to the booking (its date is the wedding's date).
//   - A function at the booked venue (or in one of the venue's own spaces) affects the booking, so it is WAITING until authorised staff
//     confirm it. A function somewhere else stands at once.
//   - Nothing here changes the venue booking, a hall hold, availability or the agreed price — confirmation is a person's decision.

export const COUPLE_FUNCTION_TYPES = FUNCTION_TYPES.filter((t) => t !== 'WEDDING') as Exclude<FunctionType, 'WEDDING'>[];
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
  if (input.type === 'WEDDING') return 'The wedding itself is set by your booking — add your other functions here';
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
  if (input.place === 'ELSEWHERE' && !input.venueName?.trim()) return 'Say where it is (for example “Home” or the place’s name)';
  if (tooLong(input.venueName, 160)) return 'Keep the place’s name under 160 characters';
  if (tooLong(input.venueAddress, 300)) return 'Keep the address under 300 characters';
  if (tooLong(input.description, 500)) return 'Keep the description under 500 characters';
  return null;
}

// A function at the booked venue (in any of its spaces) touches the booking — it waits for staff. Anywhere else stands at once.
// A venue space can only be chosen with the booked venue, so the place alone decides.
export function needsConfirmation(input: Pick<CoupleFunctionInput, 'place'>): boolean {
  return input.place === 'BOOKED_VENUE';
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

// Only the couple's own functions can be changed or removed by them.
export function coupleMayChange(event: { addedByCouple: boolean }): boolean {
  return event.addedByCouple;
}

export function functionDisplayName(e: { type: string; label: string | null }): string {
  return e.label?.trim() || FUNCTION_TYPE_LABELS[e.type as FunctionType] || 'Function';
}
