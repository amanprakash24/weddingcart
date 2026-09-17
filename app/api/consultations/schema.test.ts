/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { consultationCreateSchema } from './schema';

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Priya Sharma',
    phone: '9876543210',
    weddingDate: '2027-02-14',
    days: 1,
    guestCount: 200,
    ...overrides,
  };
}

describe('consultationCreateSchema', () => {
  test('accepts a well-formed consultation', () => {
    expect(() => consultationCreateSchema.parse(validBody())).not.toThrow();
  });

  test('rejects a missing required field', () => {
    const body = validBody();
    delete (body as Record<string, unknown>).phone;
    expect(() => consultationCreateSchema.parse(body)).toThrow();
  });

  test('accepts a valid weddingDate and leaves it as a string, not a Date', () => {
    const parsed = consultationCreateSchema.parse(validBody({ weddingDate: '2027-02-14' }));
    expect(parsed.weddingDate).toBe('2027-02-14');
    expect(typeof parsed.weddingDate).toBe('string');
  });

  // Same real-production-data trap already found and fixed on
  // Booking.weddingDate/Enquiry.eventDate.
  test('rejects the exact malformed free-text date ("20 October 20202") found in real production data', () => {
    const asDate = new Date('20 October 20202');
    expect(isNaN(asDate.getTime())).toBe(false);
    expect(() => consultationCreateSchema.parse(validBody({ weddingDate: '20 October 20202' }))).toThrow();
  });

  test('coerces days/guestCount/totalBudget from numeric strings (the route previously passed these to Prisma with no coercion at all)', () => {
    const parsed = consultationCreateSchema.parse(validBody({ days: '2', guestCount: '150', totalBudget: '500000' }));
    expect(parsed.days).toBe(2);
    expect(parsed.guestCount).toBe(150);
    expect(parsed.totalBudget).toBe(500000);
  });

  test('rejects a zero or negative days/guestCount', () => {
    expect(() => consultationCreateSchema.parse(validBody({ days: 0 }))).toThrow();
    expect(() => consultationCreateSchema.parse(validBody({ guestCount: -5 }))).toThrow();
  });

  // Production incident (2026-09-17): the /plan wizard's guest-count input
  // set state to 0 whenever a user cleared the field to retype a number, and
  // the wizard's step gate didn't check guestCount before letting them reach
  // submit — so this exact value reached the API and was rejected with no
  // Consultation row created. Fixed in PlanPageClient.tsx (canNext() now
  // requires guestCount > 0, plus an onBlur fallback); this test guards the
  // schema side of that contract so a UI regression fails loud as a 400
  // instead of silently dropping submissions again.
  test('rejects guestCount: 0 exactly (the value the /plan wizard could produce)', () => {
    expect(() => consultationCreateSchema.parse(validBody({ guestCount: 0 }))).toThrow();
  });

  test('accepts a services array and rejects a non-string entry', () => {
    const parsed = consultationCreateSchema.parse(validBody({ services: ['venue', 'catering'] }));
    expect(parsed.services).toEqual(['venue', 'catering']);
    expect(() => consultationCreateSchema.parse(validBody({ services: [123] }))).toThrow();
  });

  test('does not validate or strip weddingStyle/budgetRange/consultationDate — they are simply not part of this schema', () => {
    // These fields are read from the raw request body by the route's
    // WhatsApp message builders, never persisted — the schema doesn't
    // reject extra keys (no .strict()), so parsing a body that still has
    // them succeeds; the route is responsible for not persisting them.
    const parsed = consultationCreateSchema.parse(
      validBody({ weddingStyle: 'traditional', budgetRange: '10-20L', consultationDate: '2027-02-20' })
    );
    expect(parsed).not.toHaveProperty('weddingStyle');
  });

  test('leaves optional fields undefined when omitted', () => {
    const parsed = consultationCreateSchema.parse(validBody());
    expect(parsed.email).toBeUndefined();
    expect(parsed.city).toBeUndefined();
    expect(parsed.totalBudget).toBeUndefined();
  });
});
