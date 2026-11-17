import { describe, expect, it } from 'bun:test';
import { hallLine, hallStatusWords, heldElsewhere, toProposalHalls, type ProposalHall } from './proposalHalls';
import type { Slot } from '@/lib/venue/slots';

const spaces = [{ id: 'hall', name: 'Royal Banquet', capacity: 800, active: true }];
const slot = (over: Partial<Slot>): Slot => ({ id: 's', spaceId: 'hall', date: '2027-02-14', shift: 'NIGHT', state: 'QUOTED', name: 'Riya Sharma', note: null, enquiryId: 'e1', wedding: null, holdUntil: null, ...over });

describe('toProposalHalls', () => {
  it('maps each state to the couple’s words', () => {
    const halls = toProposalHalls({
      spaces,
      slots: [
        { ...slot({ state: 'BOOKED' }), clashes: [] },
        { ...slot({ state: 'ACCEPTED' }), clashes: [] },
        { ...slot({ state: 'HELD', holdUntil: '2026-11-19T18:29:59.999Z' }), clashes: [] },
        { ...slot({ state: 'QUOTED', holdUntil: '2026-11-10T00:00:00.000Z' }), clashes: [] }, // an old, ended hold is just "chosen"
      ],
    });
    expect(halls.map((h) => [h.status, h.heldUntil])).toEqual([['BOOKED', null], ['RESERVED', null], ['HELD', '2026-11-19T18:29:59.999Z'], ['CHOSEN', null]]);
    expect(halls[0]).toMatchObject({ hall: 'Royal Banquet', date: '2027-02-14', shift: 'NIGHT' });
  });

  it('says the hall is held for another booking — never who, and nothing else about them', () => {
    const [h] = toProposalHalls({
      spaces,
      slots: [{ ...slot({}), clashes: [slot({ id: 'x', state: 'HELD', name: 'Neha & Raj', enquiryId: 'e2', holdUntil: '2026-11-19T18:29:59.999Z' }), slot({ id: 'y', state: 'QUOTED', name: 'Pooja', enquiryId: 'e3' })] }],
    });
    expect(h.heldElsewhereUntil).toBe('2026-11-19T18:29:59.999Z');
    expect(JSON.stringify(h)).not.toMatch(/Neha|Pooja|e2|e3/);
    expect(heldElsewhere([h])).toBe(h);
  });

  it('another couple’s quote or booking is not mentioned (only an active hold stops them accepting)', () => {
    const [h] = toProposalHalls({ spaces, slots: [{ ...slot({}), clashes: [slot({ id: 'x', state: 'BOOKED', enquiryId: 'e2' }), slot({ id: 'y', state: 'QUOTED', enquiryId: 'e3' })] }] });
    expect(h.heldElsewhereUntil).toBeNull();
    expect(heldElsewhere([h])).toBeNull();
  });

  it('their own hold is never "held elsewhere"', () => {
    const [h] = toProposalHalls({ spaces, slots: [{ ...slot({ state: 'HELD', holdUntil: '2026-11-19T18:29:59.999Z' }), clashes: [slot({ id: 'x', state: 'HELD', enquiryId: 'e2', holdUntil: '2026-11-20T00:00:00.000Z' })] }] });
    expect([h.status, h.heldElsewhereUntil]).toEqual(['HELD', null]);
  });
});

describe('the words', () => {
  const base: ProposalHall = { hall: 'Royal Banquet', date: '2027-02-14', shift: 'NIGHT', status: 'CHOSEN', heldUntil: null, heldElsewhereUntil: null };
  it('hallLine', () => expect(hallLine(base)).toBe('Royal Banquet · Night · Sun, 14 Feb, 2027'));
  it('each status', () => {
    expect(hallStatusWords({ ...base, status: 'BOOKED' }, 'City Lounge')).toBe('Booked for you.');
    expect(hallStatusWords({ ...base, status: 'RESERVED' }, 'City Lounge')).toBe('Reserved for you. It is confirmed once City Lounge receives the booking amount.');
    expect(hallStatusWords({ ...base, status: 'HELD', heldUntil: '2026-11-19T18:29:59.999Z' }, 'City Lounge')).toBe('Held for you until Thu, 19 Nov, 11:59 pm. No other couple can book it until then.');
    expect(hallStatusWords(base, 'City Lounge')).toBe('Chosen for this quotation. Accepting the quotation reserves it for you.');
    expect(hallStatusWords({ ...base, heldElsewhereUntil: '2026-11-19T18:29:59.999Z' }, 'City Lounge')).toBe('This hall is held for another booking until Thu, 19 Nov, 11:59 pm. You can accept once that hold ends or City Lounge releases it.');
  });
});
