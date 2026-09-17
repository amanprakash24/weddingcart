/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { enquiryCreateSchema } from './schema';

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    vendorId: 'some-vendor',
    vendorName: 'Some Vendor',
    vendorCategory: 'Venues',
    name: 'Priya Sharma',
    phone: '9876543210',
    city: 'Patna',
    eventDate: '2027-02-14',
    eventType: 'wedding',
    ...overrides,
  };
}

describe('enquiryCreateSchema', () => {
  test('accepts a well-formed enquiry', () => {
    expect(() => enquiryCreateSchema.parse(validBody())).not.toThrow();
  });

  test('rejects a missing required field', () => {
    const body = validBody();
    delete (body as Record<string, unknown>).name;
    expect(() => enquiryCreateSchema.parse(body)).toThrow();
  });

  test('rejects an empty name/city/vendorId', () => {
    expect(() => enquiryCreateSchema.parse(validBody({ name: '' }))).toThrow();
    expect(() => enquiryCreateSchema.parse(validBody({ city: '' }))).toThrow();
    expect(() => enquiryCreateSchema.parse(validBody({ vendorId: '' }))).toThrow();
  });

  test('rejects a name over 200 characters', () => {
    expect(() => enquiryCreateSchema.parse(validBody({ name: 'a'.repeat(201) }))).toThrow();
  });

  test('accepts a valid eventDate and leaves it as a string, not a Date', () => {
    const parsed = enquiryCreateSchema.parse(validBody({ eventDate: '2027-02-14' }));
    expect(parsed.eventDate).toBe('2027-02-14');
    expect(typeof parsed.eventDate).toBe('string');
  });

  // The exact real production data that motivated this fix — JS's Date
  // constructor parses this into a *valid* Date 18000 years in the future
  // rather than failing, so no validation at all would have silently
  // accepted it (same trap already found and fixed on Booking.weddingDate).
  test('rejects the exact malformed free-text date ("20 October 20202") found in real production data', () => {
    const asDate = new Date('20 October 20202');
    expect(isNaN(asDate.getTime())).toBe(false); // confirms this is the silent-accept trap, not a no-op case
    expect(() => enquiryCreateSchema.parse(validBody({ eventDate: '20 October 20202' }))).toThrow();
  });

  test('rejects a YYYY-MM-DD-shaped but semantically invalid eventDate (month 13)', () => {
    expect(() => enquiryCreateSchema.parse(validBody({ eventDate: '2027-13-45' }))).toThrow();
  });

  test('accepts an optional guestCount as a string (matches the Enquiry.guestCount column type)', () => {
    const parsed = enquiryCreateSchema.parse(validBody({ guestCount: '250' }));
    expect(parsed.guestCount).toBe('250');
  });

  test('leaves email/guestCount/message undefined when omitted', () => {
    const parsed = enquiryCreateSchema.parse(validBody());
    expect(parsed.email).toBeUndefined();
    expect(parsed.guestCount).toBeUndefined();
    expect(parsed.message).toBeUndefined();
  });
});
