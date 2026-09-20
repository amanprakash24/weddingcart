/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { ConflictError, ConversionLockedError } from '@/lib/errors';
import { evaluateBookable } from './rules';

const ok = { status: 'ACCEPTED' as const, sourceType: 'ENQUIRY', sourceLabel: 'enquiry', hasBooking: false, wedding: null };

describe('evaluateBookable — an accepted quotation becomes a Booking, once', () => {
  test('an ACCEPTED quotation on an enquiry or consultation with no booking or wedding can be booked', () => {
    expect(evaluateBookable(ok)).toBeNull();
    expect(evaluateBookable({ ...ok, sourceType: 'CONSULTATION', sourceLabel: 'consultation' })).toBeNull();
  });

  test.each(['DRAFT', 'SENT'] as const)('%s tells staff to record the customer acceptance first', (status) => {
    const err = evaluateBookable({ ...ok, status });
    expect(err).toBeInstanceOf(ConflictError);
    expect(err?.message).toContain("Record the customer's acceptance");
  });

  test.each(['REJECTED', 'EXPIRED', 'SUPERSEDED'] as const)('%s cannot be booked and says why', (status) => {
    const err = evaluateBookable({ ...ok, status });
    expect(err).toBeInstanceOf(ConflictError);
    expect(err?.message).toContain(status.toLowerCase());
  });

  test('a second booking for the same quotation is refused', () => {
    const err = evaluateBookable({ ...ok, hasBooking: true });
    expect(err).toBeInstanceOf(ConflictError);
    expect(err?.message).toBe('A booking was already created from this quotation');
  });

  test('a source that already converted to a Wedding is locked and the message names it', () => {
    const err = evaluateBookable({ ...ok, wedding: { weddingNumber: 'WED-2026-0002' } });
    expect(err).toBeInstanceOf(ConversionLockedError);
    expect(err?.message).toContain('WED-2026-0002');
  });

  test('a lead quotation is not booked here — leads convert to a wedding through the CRM', () => {
    const err = evaluateBookable({ ...ok, sourceType: 'LEAD', sourceLabel: 'lead' });
    expect(err).toBeInstanceOf(ConflictError);
    expect(err?.message).toContain('through the CRM');
  });
});
