import { describe, expect, it } from 'bun:test';
import { coupleFunctionFields, coupleFunctionProblem, coupleMayChange, functionDisplayName, needsConfirmation, type CoupleFunctionInput } from './coupleFunctions';

const TODAY = '2026-11-22';
const haldiAtHome: CoupleFunctionInput = { type: 'HALDI', date: '2026-11-28', startTime: '10:00', endTime: '13:00', place: 'ELSEWHERE', venueName: 'Home', venueAddress: 'Boring Road, Patna', description: 'Family only' };
const sangeetAtVenue: CoupleFunctionInput = { type: 'SANGEET', date: '2026-11-29', startTime: '19:00', endTime: '23:30', place: 'BOOKED_VENUE' };

describe('coupleFunctionProblem', () => {
  it('accepts a complete function elsewhere and one at the booked venue', () => {
    expect(coupleFunctionProblem(haldiAtHome, TODAY)).toBeNull();
    expect(coupleFunctionProblem(sangeetAtVenue, TODAY)).toBeNull();
  });
  it('never lets a couple add the Wedding itself', () => {
    expect(coupleFunctionProblem({ ...haldiAtHome, type: 'WEDDING' }, TODAY)).toContain('set by your booking');
  });
  it('refuses unknown types, an unnamed Other, past and impossible dates', () => {
    expect(coupleFunctionProblem({ ...haldiAtHome, type: 'PARTY' }, TODAY)).toBe('Choose what kind of function it is');
    expect(coupleFunctionProblem({ ...haldiAtHome, type: 'OTHER', name: ' ' }, TODAY)).toContain('Give this function a name');
    expect(coupleFunctionProblem({ ...haldiAtHome, date: '2026-11-21' }, TODAY)).toBe('The date has already passed');
    expect(coupleFunctionProblem({ ...haldiAtHome, date: '2026-02-30' }, TODAY)).toBe('Choose the date');
  });
  it('times: valid format, an end needs a start, end may run past midnight but not equal the start', () => {
    expect(coupleFunctionProblem({ ...haldiAtHome, startTime: '25:00' }, TODAY)).toContain('Start time');
    expect(coupleFunctionProblem({ ...haldiAtHome, endTime: '9pm' }, TODAY)).toContain('End time');
    expect(coupleFunctionProblem({ ...haldiAtHome, startTime: null }, TODAY)).toBe('Add a start time too');
    expect(coupleFunctionProblem({ ...haldiAtHome, endTime: '10:00' }, TODAY)).toContain('same as the start');
    expect(coupleFunctionProblem({ ...sangeetAtVenue, endTime: '01:00' }, TODAY)).toBeNull(); // 19:00 → 1 am
  });
  it('elsewhere needs a place; lengths are capped', () => {
    expect(coupleFunctionProblem({ ...haldiAtHome, venueName: '' }, TODAY)).toContain('Say where it is');
    expect(coupleFunctionProblem({ ...haldiAtHome, description: 'x'.repeat(501) }, TODAY)).toContain('500');
    expect(coupleFunctionProblem({ ...haldiAtHome, name: 'x'.repeat(81) }, TODAY)).toContain('80');
  });
});

describe('needsConfirmation and stored fields', () => {
  it('at the booked venue (or a venue space) waits for staff; elsewhere stands at once', () => {
    expect(needsConfirmation(sangeetAtVenue)).toBe(true);
    expect(needsConfirmation({ place: 'ELSEWHERE' })).toBe(false); // a hall chosen with 'elsewhere' is dropped, so it never waits
    expect(needsConfirmation(haldiAtHome)).toBe(false);
    expect(coupleFunctionFields(sangeetAtVenue).confirmation).toBe('WAITING');
    expect(coupleFunctionFields(haldiAtHome).confirmation).toBe('CONFIRMED');
  });
  it('the place decides which venue fields are kept; blanks become nothing', () => {
    const v = coupleFunctionFields({ ...sangeetAtVenue, venueName: 'ignored', venueSpaceId: 'hall-1', description: '  ' });
    expect(v).toMatchObject({ atBookedVenue: true, venueSpaceId: 'hall-1', venueName: null, venueAddress: null, description: null });
    const h = coupleFunctionFields({ ...haldiAtHome, venueSpaceId: 'hall-1' });
    expect(h).toMatchObject({ atBookedVenue: false, venueSpaceId: null, venueName: 'Home', confirmation: 'CONFIRMED' });
    expect(h.date.toISOString()).toBe('2026-11-28T00:00:00.000Z');
  });
});

describe('who may change what', () => {
  it('only the couple’s own functions', () => {
    expect(coupleMayChange({ addedByCouple: true })).toBe(true);
    expect(coupleMayChange({ addedByCouple: false })).toBe(false);
  });
  it('display name', () => {
    expect(functionDisplayName({ type: 'HALDI', label: null })).toBe('Haldi');
    expect(functionDisplayName({ type: 'OTHER', label: 'Cocktail night' })).toBe('Cocktail night');
  });
});
