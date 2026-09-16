/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { ConversionLockedError, InvalidTransitionError } from '@/lib/errors';

// evaluateEnquiryDeleteGuard doesn't touch prisma itself, but importing
// enquiry.service.ts (to reach it) pulls in its full static import chain,
// down to lib/prisma.ts — which throws at module-load time if DATABASE_URL
// isn't set (it isn't, under `bun test`). Stubbed here rather than left
// real; never actually called by anything this test exercises.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { evaluateEnquiryDeleteGuard } = await import('./enquiry.service');

// Production-integrity fix: Wedding.sourceEnquiryId and Booking.enquiryId
// both default to onDelete: SetNull — without a guard, deleting an Enquiry
// silently severs either link instead of being refused, reopening the
// duplicate-Wedding guard hole (services/weddingConversion.service.ts) for
// any Booking or Wedding that pointed back to it. Mirrors the same guard
// already shipped for Lead in lead.service.ts.
//
// evaluateEnquiryDeleteGuard is the pure decision extracted from delete() —
// tested directly rather than mocking prisma/repositories/weddingConversion
// .service: mock.module() intercepts by resolved file path, not the literal
// specifier string, so mocking weddingConversion.service (or its
// weddingRepository dependency) here would also hijack
// weddingConversion.service.test.ts's own direct import of those same
// files, silently breaking its coverage — confirmed by reproduction. The
// actual delete() orchestration (call findWeddingForSource, conditionally
// count linked Bookings, apply this guard) is a thin 5-line wrapper with no
// branching logic of its own beyond what's covered here.
describe('evaluateEnquiryDeleteGuard', () => {
  test('blocks with ConversionLockedError when this Enquiry already converted to a Wedding', () => {
    const result = evaluateEnquiryDeleteGuard({ weddingNumber: 'WED-2027-0001' }, 0);
    expect(result).toBeInstanceOf(ConversionLockedError);
    expect(result?.message).toBe('Cannot delete: this enquiry converted to Wedding WED-2027-0001');
  });

  test('blocks with InvalidTransitionError when a Booking still links to this Enquiry, even with no Wedding yet', () => {
    const result = evaluateEnquiryDeleteGuard(null, 2);
    expect(result).toBeInstanceOf(InvalidTransitionError);
    expect(result?.message).toBe('Cannot delete: this enquiry has 2 linked booking(s)');
  });

  test('an existing Wedding takes priority over a linked-Booking count — same-priority rule as the Booking-path guard', () => {
    const result = evaluateEnquiryDeleteGuard({ weddingNumber: 'WED-2027-0001' }, 5);
    expect(result).toBeInstanceOf(ConversionLockedError);
  });

  test('allows deletion (returns null) when there is no Wedding and no linked Booking — normal, unaffected case', () => {
    expect(evaluateEnquiryDeleteGuard(null, 0)).toBeNull();
  });
});
