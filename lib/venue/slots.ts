// Halls and shifts (17 Nov 2026, founder: before launch). A venue has halls and lawns ("spaces"); each enquiry reserves a hall on a
// date for a shift: Day, Night or Full day (both). A venue can also block a hall's shift by hand. Pure and client-safe: the
// services load the rows, this says what they mean.
//
// What a reserved slot counts as follows its enquiry — the same stages as the rest of the app:
//   BOOKED   the enquiry's booking is confirmed (the amount to confirm was received)
//   ACCEPTED the couple accepted; the booking waits for its confirming payment
//   QUOTED   reserved on the enquiry, nothing accepted yet — shown, but it does not take the hall
//   BLOCKED  the venue blocked it by hand (no enquiry)
// A clash is a WARNING on an enquiry, never a block: two couples can be quoted for one hall. Blocking by hand is refused only over a
// hall that is already booked, accepted or blocked for that shift.

export const SHIFTS = ['DAY', 'NIGHT', 'FULL_DAY'] as const;
export type Shift = (typeof SHIFTS)[number];
export const SHIFT_LABEL: Record<Shift, string> = { DAY: 'Day', NIGHT: 'Night', FULL_DAY: 'Full day' };
export const isShift = (v: unknown): v is Shift => (SHIFTS as readonly string[]).includes(v as string);

export type SlotState = 'BOOKED' | 'ACCEPTED' | 'QUOTED' | 'BLOCKED';
export const SLOT_STATE_LABEL: Record<SlotState, string> = { BOOKED: 'Booked', ACCEPTED: 'Accepted, not confirmed yet', QUOTED: 'Quoted', BLOCKED: 'Blocked' };
// The states that take the hall for that shift.
export const TAKES_HALL: readonly SlotState[] = ['BOOKED', 'ACCEPTED', 'BLOCKED'];

// Full day overlaps both halves; Day and Night do not overlap each other.
export const shiftsOverlap = (a: Shift, b: Shift) => a === b || a === 'FULL_DAY' || b === 'FULL_DAY';

export const SPACE_LIMITS = { nameMax: 60, maxCapacity: 100_000, maxSpaces: 20, noteMax: 200 } as const;

export interface Space {
  id: string;
  name: string;
  capacity: number | null;
  active: boolean;
}

// One slot as every screen sees it.
export interface Slot {
  id: string;
  spaceId: string;
  date: string; // YYYY-MM-DD
  shift: Shift;
  state: SlotState;
  name: string | null; // the couple — null for a block
  note: string | null; // why it was blocked
  enquiryId: string | null;
  wedding: { id: string; number: string } | null;
}

// The enquiry behind a slot, as loaded: its stage and its bookings.
export interface SlotEnquiry {
  id: string;
  name: string;
  pipelineStage: string;
  bookings: { status: string; wedding: { id: string; weddingNumber: string } | null }[];
}

// What a reserved slot counts as. null = not shown at all (the enquiry was closed as not going ahead, or its booking closed).
export function slotState(enquiry: SlotEnquiry | null): SlotState | null {
  if (!enquiry) return 'BLOCKED';
  const open = enquiry.bookings.filter((b) => b.status !== 'CLOSED');
  if (open.some((b) => b.status === 'CONFIRMED')) return 'BOOKED';
  if (open.length > 0 || enquiry.pipelineStage === 'ACCEPTED' || enquiry.pipelineStage === 'WON') return 'ACCEPTED';
  if (enquiry.pipelineStage === 'LOST') return null;
  if (enquiry.bookings.length > 0) return null; // every booking it had was closed
  return 'QUOTED';
}

type Row = { id: string; spaceId: string; date: Date; shift: string; note: string | null; consultation: SlotEnquiry | null };

export function slotOf(row: Row): Slot | null {
  const state = slotState(row.consultation);
  if (!state || !isShift(row.shift)) return null;
  const wedding = row.consultation?.bookings.find((b) => b.status !== 'CLOSED' && b.wedding)?.wedding ?? null;
  return {
    id: row.id,
    spaceId: row.spaceId,
    date: row.date.toISOString().slice(0, 10),
    shift: row.shift,
    state,
    name: row.consultation?.name ?? null,
    note: row.consultation ? null : row.note,
    enquiryId: row.consultation?.id ?? null,
    wedding: wedding ? { id: wedding.id, number: wedding.weddingNumber } : null,
  };
}

// The other slots that clash with this one: the same hall, the same date, an overlapping shift, and not the same enquiry. Booked
// first, then accepted, blocked, quoted.
const ORDER: Record<SlotState, number> = { BOOKED: 0, ACCEPTED: 1, BLOCKED: 2, QUOTED: 3 };
export function clashes(slot: Pick<Slot, 'id' | 'spaceId' | 'date' | 'shift' | 'enquiryId'>, others: readonly Slot[]): Slot[] {
  return others
    .filter((o) => o.id !== slot.id && o.spaceId === slot.spaceId && o.date === slot.date && shiftsOverlap(o.shift, slot.shift))
    .filter((o) => !slot.enquiryId || o.enquiryId !== slot.enquiryId)
    .sort((a, b) => ORDER[a.state] - ORDER[b.state]);
}

// The warning line for one clash: "Booked — Riya & Aman", "Blocked — maintenance".
export function clashWords(c: Slot): string {
  const who = c.state === 'BLOCKED' ? c.note || 'by you' : c.name || 'another couple';
  return `${SLOT_STATE_LABEL[c.state]} — ${who} (${SHIFT_LABEL[c.shift]})`;
}

// How full one day is, across the venue's active halls: FULL = every hall's day and night are taken; PART = something is taken or
// quoted; null = nothing at all.
export type DayFill = 'FULL' | 'PART' | null;
export function dayFill(spaces: readonly Space[], slots: readonly Slot[]): DayFill {
  if (slots.length === 0) return null;
  const halls = spaces.filter((s) => s.active);
  const taken = (spaceId: string, half: 'DAY' | 'NIGHT') => slots.some((s) => s.spaceId === spaceId && TAKES_HALL.includes(s.state) && shiftsOverlap(s.shift, half));
  if (halls.length > 0 && halls.every((h) => taken(h.id, 'DAY') && taken(h.id, 'NIGHT'))) return 'FULL';
  return 'PART';
}

// What one hall's half-day shows on the day panel: the slot that takes it, or a quote that wants it, or free.
export function halfOf(spaceId: string, half: 'DAY' | 'NIGHT', slots: readonly Slot[]): { taken: Slot | null; quoted: Slot[] } {
  const here = slots.filter((s) => s.spaceId === spaceId && shiftsOverlap(s.shift, half));
  const taken = here.filter((s) => TAKES_HALL.includes(s.state)).sort((a, b) => ORDER[a.state] - ORDER[b.state])[0] ?? null;
  return { taken, quoted: here.filter((s) => s.state === 'QUOTED') };
}

// ---------- the forms ----------

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (d: string) => DAY.test(d) && new Date(`${d}T00:00:00.000Z`).toISOString().slice(0, 10) === d;

export type SpaceErrors = Partial<Record<'name' | 'capacity', string>>;
export interface SpaceInput {
  name: string;
  capacity: number | null;
  active: boolean;
}

export function validateSpace(input: Record<string, unknown>): { ok: true; value: SpaceInput } | { ok: false; errors: SpaceErrors } {
  const errors: SpaceErrors = {};
  const name = str(input.name).replace(/\s+/g, ' ');
  if (!name) errors.name = 'Give the hall or lawn a name';
  else if (name.length > SPACE_LIMITS.nameMax) errors.name = `Please keep the name under ${SPACE_LIMITS.nameMax} characters`;
  const rawCap = str(input.capacity).replace(/[,\s]/g, '');
  let capacity: number | null = null;
  if (rawCap) {
    if (!/^\d{1,6}$/.test(rawCap) || Number(rawCap) < 1 || Number(rawCap) > SPACE_LIMITS.maxCapacity) errors.capacity = 'Enter how many guests it holds, or leave it empty';
    else capacity = Number(rawCap);
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, capacity, active: input.active !== false } };
}

export type SlotErrors = Partial<Record<'spaceId' | 'date' | 'shift' | 'note', string>>;
export interface SlotInput {
  spaceId: string;
  date: string;
  shift: Shift;
  note: string | null;
}

export function validateSlot(input: Record<string, unknown>, today: string): { ok: true; value: SlotInput } | { ok: false; errors: SlotErrors } {
  const errors: SlotErrors = {};
  const spaceId = str(input.spaceId);
  if (!spaceId) errors.spaceId = 'Choose the hall or lawn';
  const date = str(input.date);
  if (!isDay(date)) errors.date = 'Pick the date';
  else if (date < today) errors.date = 'Pick today or a later date';
  const shift = str(input.shift);
  if (!isShift(shift)) errors.shift = 'Choose Day, Night or Full day';
  const note = str(input.note).replace(/\s+/g, ' ');
  if (note.length > SPACE_LIMITS.noteMax) errors.note = `Please keep this under ${SPACE_LIMITS.noteMax} characters`;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { spaceId, date, shift: shift as Shift, note: note || null } };
}
