import { describe, expect, it } from 'bun:test';
import { clashes, clashWords, dayFill, halfOf, shiftsOverlap, slotOf, slotState, validateSlot, validateSpace, type Slot, type Space } from './slots';

const enquiry = (stage: string, bookings: { status: string; wedding?: { id: string; weddingNumber: string } | null }[] = []) => ({
  id: 'e1',
  name: 'Riya & Aman',
  pipelineStage: stage,
  bookings: bookings.map((b) => ({ status: b.status, wedding: b.wedding ?? null })),
});

const slot = (over: Partial<Slot>): Slot => ({ id: 's', spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT', state: 'BOOKED', name: 'X', note: null, enquiryId: 'e', wedding: null, ...over });

describe('shiftsOverlap', () => {
  it('day and night are separate; full day takes both', () => {
    expect(shiftsOverlap('DAY', 'NIGHT')).toBe(false);
    expect(shiftsOverlap('DAY', 'DAY')).toBe(true);
    expect(shiftsOverlap('FULL_DAY', 'NIGHT')).toBe(true);
    expect(shiftsOverlap('DAY', 'FULL_DAY')).toBe(true);
  });
});

describe('slotState', () => {
  it('a hand block has no enquiry', () => expect(slotState(null)).toBe('BLOCKED'));
  it('a confirmed booking is booked', () => expect(slotState(enquiry('WON', [{ status: 'CONFIRMED' }]))).toBe('BOOKED'));
  it('a booking waiting for payment is accepted', () => expect(slotState(enquiry('ACCEPTED', [{ status: 'NEW' }]))).toBe('ACCEPTED'));
  it('accepted with no booking yet is accepted', () => expect(slotState(enquiry('ACCEPTED'))).toBe('ACCEPTED'));
  it('an open enquiry is only quoted', () => expect(slotState(enquiry('QUOTATION_SENT'))).toBe('QUOTED'));
  it('a lost enquiry frees the hall', () => expect(slotState(enquiry('LOST'))).toBeNull());
  it('a closed booking frees the hall', () => expect(slotState(enquiry('NEGOTIATION', [{ status: 'CLOSED' }]))).toBeNull());
  it('a closed enquiry frees the hall even with a booking still waiting', () => expect(slotState(enquiry('LOST', [{ status: 'NEW' }]))).toBeNull());
  it('accepted or booked stage with every booking closed frees the hall', () => {
    expect(slotState(enquiry('ACCEPTED', [{ status: 'CLOSED' }]))).toBeNull();
    expect(slotState(enquiry('WON', [{ status: 'CLOSED' }]))).toBeNull();
  });
  it('a confirmed booking holds the hall even if the enquiry was closed', () => expect(slotState(enquiry('LOST', [{ status: 'CONFIRMED' }]))).toBe('BOOKED'));
});

describe('slotOf', () => {
  it('reads the date as stored and names the wedding', () => {
    const s = slotOf({ id: 'a', spaceId: 'hall', date: new Date('2026-12-12T00:00:00.000Z'), shift: 'NIGHT', note: 'ignored', consultation: enquiry('WON', [{ status: 'CONFIRMED', wedding: { id: 'w', weddingNumber: 'WED-1' } }]) });
    expect(s).toEqual({ id: 'a', spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT', state: 'BOOKED', name: 'Riya & Aman', note: null, enquiryId: 'e1', wedding: { id: 'w', number: 'WED-1' } });
  });
  it('a block keeps its note', () => {
    expect(slotOf({ id: 'b', spaceId: 'hall', date: new Date('2026-12-12T00:00:00.000Z'), shift: 'DAY', note: 'Repairs', consultation: null })?.note).toBe('Repairs');
  });
});

describe('clashes', () => {
  const others = [
    slot({ id: '1', state: 'QUOTED', enquiryId: 'q' }),
    slot({ id: '2', state: 'BOOKED', enquiryId: 'b', shift: 'FULL_DAY' }),
    slot({ id: '3', shift: 'DAY', enquiryId: 'd' }), // day vs night: no clash
    slot({ id: '4', spaceId: 'lawn', enquiryId: 'l' }), // other hall
    slot({ id: '5', date: '2026-12-13', enquiryId: 'n' }), // other date
    slot({ id: '6', enquiryId: 'mine' }), // the same enquiry
  ];
  it('finds the same hall, date and overlapping shift of other enquiries, booked first', () => {
    expect(clashes({ id: 'new', spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT', enquiryId: 'mine' }, others).map((c) => c.id)).toEqual(['2', '1']);
  });
  it('words a block by its note', () => {
    expect(clashWords(slot({ state: 'BLOCKED', note: 'Repairs', name: null }))).toBe('Blocked — Repairs (Night)');
  });
});

describe('dayFill and halfOf', () => {
  const spaces: Space[] = [
    { id: 'hall', name: 'Hall', capacity: null, active: true },
    { id: 'lawn', name: 'Lawn', capacity: null, active: true },
    { id: 'old', name: 'Old', capacity: null, active: false },
  ];
  it('nothing → null; some → PART; every active hall both halves → FULL', () => {
    expect(dayFill(spaces, [])).toBeNull();
    expect(dayFill(spaces, [slot({ spaceId: 'hall', shift: 'FULL_DAY' })])).toBe('PART');
    expect(dayFill(spaces, [slot({ spaceId: 'hall', shift: 'FULL_DAY' }), slot({ spaceId: 'lawn', shift: 'DAY', state: 'BLOCKED' }), slot({ spaceId: 'lawn', shift: 'NIGHT', state: 'ACCEPTED' })])).toBe('FULL');
  });
  it('a quote does not fill a day', () => {
    expect(dayFill(spaces, [slot({ spaceId: 'hall', shift: 'FULL_DAY', state: 'QUOTED' }), slot({ spaceId: 'lawn', shift: 'FULL_DAY', state: 'QUOTED' })])).toBe('PART');
  });
  it('halfOf: what takes the half, and the quotes that want it', () => {
    const slots = [slot({ id: 'q', state: 'QUOTED', shift: 'NIGHT' }), slot({ id: 'f', state: 'ACCEPTED', shift: 'FULL_DAY' })];
    expect(halfOf('hall', 'DAY', slots).taken?.id).toBe('f');
    expect(halfOf('hall', 'NIGHT', slots).quoted.map((s) => s.id)).toEqual(['q']);
    expect(halfOf('lawn', 'DAY', slots)).toEqual({ taken: null, quoted: [] });
  });
});

describe('validateSpace', () => {
  it('needs a name; capacity is optional and a whole number', () => {
    expect(validateSpace({ name: '  Royal   Hall ', capacity: '1,200' })).toEqual({ ok: true, value: { name: 'Royal Hall', capacity: 1200, active: true } });
    expect(validateSpace({ name: '' })).toEqual({ ok: false, errors: { name: 'Give the hall or lawn a name' } });
    expect(validateSpace({ name: 'Lawn', capacity: '0' }).ok).toBe(false);
    expect(validateSpace({ name: 'Lawn', capacity: '' })).toEqual({ ok: true, value: { name: 'Lawn', capacity: null, active: true } });
    expect(validateSpace({ name: 'Lawn', active: false })).toEqual({ ok: true, value: { name: 'Lawn', capacity: null, active: false } });
  });
});

describe('validateSlot', () => {
  it('a hall, a real date from today, and a shift', () => {
    expect(validateSlot({ spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT' }, '2026-11-17')).toEqual({ ok: true, value: { spaceId: 'hall', date: '2026-12-12', shift: 'NIGHT', note: null } });
    const bad = validateSlot({ spaceId: '', date: '2026-02-31', shift: 'EVENING' }, '2026-11-17');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(['date', 'shift', 'spaceId']);
    expect(validateSlot({ spaceId: 'h', date: '2026-11-16', shift: 'DAY' }, '2026-11-17').ok).toBe(false);
  });
});
