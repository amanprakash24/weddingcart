import { describe, expect, it } from 'bun:test';
import { blockedHall, hallLine, hallStatusWords, liveHalls, toProposalHalls, type ProposalHall } from './proposalHalls';
import type { Slot } from '@/lib/venue/slots';

const slot = (over: Partial<Slot>): Slot => ({ id: 's', spaceId: 'hall', date: '2027-02-14', shift: 'NIGHT', state: 'QUOTED', name: 'Riya Sharma', note: null, enquiryId: 'e1', wedding: null, holdUntil: null, ...over });
const other = (over: Partial<Slot>) => slot({ id: 'x', name: 'Neha & Raj', enquiryId: 'e2', ...over });
const UNTIL = '2026-11-19T18:29:59.999Z';

describe('toProposalHalls', () => {
  it('maps each state to the couple’s status', () => {
    const halls = toProposalHalls([
      { hall: 'Royal Banquet', slot: slot({ state: 'BOOKED' }), blocker: undefined },
      { hall: 'Royal Banquet', slot: slot({ state: 'ACCEPTED' }), blocker: undefined },
      { hall: 'Royal Banquet', slot: slot({ state: 'HELD', holdUntil: UNTIL }), blocker: undefined },
      { hall: 'Royal Banquet', slot: slot({ state: 'QUOTED', holdUntil: '2026-11-10T00:00:00.000Z' }), blocker: undefined },
    ]);
    expect(halls.map((h) => [h.status, h.heldUntil, h.blockedBy])).toEqual([['BOOKED', null, null], ['RESERVED', null, null], ['HELD', UNTIL, null], ['CHOSEN', null, null]]);
  });

  it('a hall taken by someone else: a hold says until when; a booking, acceptance or block says only that it is taken — never who', () => {
    const [held, booked, blocked] = toProposalHalls([
      { hall: 'Royal Banquet', slot: slot({}), blocker: other({ state: 'HELD', holdUntil: UNTIL }) },
      { hall: 'Royal Banquet', slot: slot({}), blocker: other({ state: 'BOOKED' }) },
      { hall: 'Royal Banquet', slot: slot({}), blocker: other({ state: 'BLOCKED', name: null, note: 'Owner function', enquiryId: null }) },
    ]);
    expect([held.blockedBy, booked.blockedBy, blocked.blockedBy]).toEqual([{ heldUntil: UNTIL }, { heldUntil: null }, { heldUntil: null }]);
    expect(JSON.stringify([held, booked, blocked])).not.toMatch(/Neha|e2|Owner function/);
  });

  it('their own hold or booking is never shown as taken by someone else', () => {
    const [h] = toProposalHalls([{ hall: 'Royal Banquet', slot: slot({ state: 'HELD', holdUntil: UNTIL }), blocker: other({ state: 'HELD', holdUntil: UNTIL }) }]);
    expect([h.status, h.blockedBy]).toEqual(['HELD', null]);
  });
});

describe('liveHalls — the page follows the clock', () => {
  const base: ProposalHall = { hall: 'Royal Banquet', date: '2027-02-14', shift: 'NIGHT', status: 'CHOSEN', heldUntil: null, blockedBy: null };
  it('another booking’s hold ends → free again; their own hold ends → chosen again', () => {
    const before = new Date('2026-11-19T18:00:00Z');
    const after = new Date('2026-11-19T18:30:00Z');
    const halls = [{ ...base, blockedBy: { heldUntil: UNTIL } }, { ...base, status: 'HELD' as const, heldUntil: UNTIL }, { ...base, blockedBy: { heldUntil: null } }];
    expect(liveHalls(halls, before)).toEqual(halls);
    expect(liveHalls(halls, after)).toEqual([{ ...base }, { ...base }, { ...base, blockedBy: { heldUntil: null } }]); // a booking does not end by the clock
    expect(blockedHall(liveHalls(halls, after))).toEqual({ ...base, blockedBy: { heldUntil: null } });
  });
});

describe('the words', () => {
  const base: ProposalHall = { hall: 'Royal Banquet', date: '2027-02-14', shift: 'NIGHT', status: 'CHOSEN', heldUntil: null, blockedBy: null };
  it('hallLine', () => expect(hallLine(base)).toBe('Royal Banquet · Night · Sun, 14 Feb, 2027'));
  it('while the quotation can be accepted', () => {
    expect(hallStatusWords({ ...base, status: 'BOOKED' }, 'City Lounge', true)).toBe('Booked for you.');
    expect(hallStatusWords({ ...base, status: 'RESERVED' }, 'City Lounge', true)).toBe('Reserved for you. It is confirmed once City Lounge receives the booking amount.');
    expect(hallStatusWords({ ...base, status: 'HELD', heldUntil: UNTIL }, 'City Lounge', true)).toBe('Held for you until Thu, 19 Nov, 11:59 pm. No other couple can book it until then.');
    expect(hallStatusWords(base, 'City Lounge', true)).toBe('Chosen for this quotation. Accepting the quotation reserves it for you.');
    // the same sentence the server refuses with (lib/venue/slots.ts hallUnavailableWords)
    expect(hallStatusWords({ ...base, blockedBy: { heldUntil: UNTIL } }, 'City Lounge', true)).toBe('Royal Banquet is temporarily held for another booking for the night of Sun, 14 Feb, 2027, until Thu, 19 Nov, 11:59 pm. You can accept once that hold ends or the venue releases it — please contact the venue.');
    expect(hallStatusWords({ ...base, blockedBy: { heldUntil: null } }, 'City Lounge', true)).toBe('Royal Banquet is not available for the night of Sun, 14 Feb, 2027. Please contact the venue.');
  });
  it('an expired or no-longer-open quotation promises nothing', () => {
    expect(hallStatusWords(base, 'City Lounge', false)).toBe('Chosen for this quotation.');
    expect(hallStatusWords({ ...base, blockedBy: { heldUntil: UNTIL } }, 'City Lounge', false)).toBe('Chosen for this quotation.');
    expect(hallStatusWords({ ...base, status: 'HELD', heldUntil: UNTIL }, 'City Lounge', false)).toBe('Held for you until Thu, 19 Nov, 11:59 pm.');
  });
});
