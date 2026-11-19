/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { guestInputSchema } from './guestInput';

// The guest editor sends back the guest it loaded; details never filled in arrive as null (Client OS audit, 19 Nov 2026).
describe('guestInputSchema', () => {
  test('a guest with only a name, as loaded from the database, is accepted', () => {
    const r = guestInputSchema.safeParse({ name: 'Ravi', phone: null, email: null, category: null, notes: null, accompanyingGuests: 0, rsvpStatus: 'ATTENDING', functionResponses: [] });
    expect(r.success).toBe(true);
  });
  test('missing details and empty email are accepted too', () => {
    expect(guestInputSchema.safeParse({ name: 'Ravi' }).success).toBe(true);
    expect(guestInputSchema.safeParse({ name: 'Ravi', email: '' }).success).toBe(true);
  });
  test('still refused: no name, a bad email, more than 20 people with them, an unknown status', () => {
    expect(guestInputSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(guestInputSchema.safeParse({ name: 'Ravi', email: 'not-an-email' }).success).toBe(false);
    expect(guestInputSchema.safeParse({ name: 'Ravi', accompanyingGuests: 21 }).success).toBe(false);
    expect(guestInputSchema.safeParse({ name: 'Ravi', rsvpStatus: 'YES' }).success).toBe(false);
  });
});
