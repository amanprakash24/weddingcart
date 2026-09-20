/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { ConversionLockedError, InvalidTransitionError, ConflictError } from '@/lib/errors';

// Production-integrity fix — see services/enquiry.service.test.ts for the
// full reasoning (including why lib/prisma is stubbed here). Mirrors it for
// Consultation (Wedding.sourceConsultationId and Booking.consultationId both
// default to onDelete: SetNull).
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { evaluateConsultationDeleteGuard } = await import('./consultation.service');

describe('evaluateConsultationDeleteGuard', () => {
  test('blocks with ConversionLockedError when this Consultation already converted to a Wedding', () => {
    const result = evaluateConsultationDeleteGuard({ weddingNumber: 'WED-2027-0001' }, 0);
    expect(result).toBeInstanceOf(ConversionLockedError);
    expect(result?.message).toBe('Cannot delete: this consultation converted to Wedding WED-2027-0001');
  });

  test('blocks with InvalidTransitionError when a Booking still links to this Consultation, even with no Wedding yet', () => {
    const result = evaluateConsultationDeleteGuard(null, 1);
    expect(result).toBeInstanceOf(InvalidTransitionError);
    expect(result?.message).toBe('Cannot delete: this consultation has 1 linked booking(s)');
  });

  test('an existing Wedding takes priority over a linked-Booking count — same-priority rule as the Booking-path guard', () => {
    const result = evaluateConsultationDeleteGuard({ weddingNumber: 'WED-2027-0001' }, 5);
    expect(result).toBeInstanceOf(ConversionLockedError);
  });

  test('allows deletion (returns null) when there is no Wedding and no linked Booking — normal, unaffected case', () => {
    expect(evaluateConsultationDeleteGuard(null, 0)).toBeNull();
  });
});

describe('evaluateConsultationDeleteGuard — quotations (08-quotation.md)', () => {
  test('refuses when the consultation has quotations, with a clear 409 message', () => {
    const result = evaluateConsultationDeleteGuard(null, 0, 2);
    expect(result).toBeInstanceOf(ConflictError);
    expect(result?.message).toContain('has 2 quotation(s)');
  });

  test('an existing Wedding still wins over quotations (surest already-happened case first)', () => {
    expect(evaluateConsultationDeleteGuard({ weddingNumber: 'WED-2027-0001' }, 0, 3)).toBeInstanceOf(ConversionLockedError);
  });

  test('a linked Booking still wins over quotations', () => {
    expect(evaluateConsultationDeleteGuard(null, 1, 3)).toBeInstanceOf(InvalidTransitionError);
  });

  test('no quotations and nothing else linked allows the delete; the count defaults to 0 for existing callers', () => {
    expect(evaluateConsultationDeleteGuard(null, 0, 0)).toBeNull();
    expect(evaluateConsultationDeleteGuard(null, 0)).toBeNull();
  });
});
