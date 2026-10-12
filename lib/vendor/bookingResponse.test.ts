/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { checkBookingResponse, DECLINE_REASON } from './bookingResponse';

describe('checkBookingResponse', () => {
  test('confirm needs nothing else', () => {
    expect(checkBookingResponse({ answer: 'CONFIRM', reason: 'ignored' })).toEqual({ ok: true, status: 'CONFIRMED', reason: null });
  });

  test('decline needs a reason, kept tidy', () => {
    expect(checkBookingResponse({ answer: 'DECLINE', reason: '  Already booked\n that night ' })).toEqual({ ok: true, status: 'DECLINED', reason: 'Already booked that night' });
  });

  test('a decline without a real reason, or with too long a one, is refused', () => {
    expect(checkBookingResponse({ answer: 'DECLINE' }).ok).toBe(false);
    expect(checkBookingResponse({ answer: 'DECLINE', reason: '  no ' }).ok).toBe(false);
    expect(checkBookingResponse({ answer: 'DECLINE', reason: 'x'.repeat(DECLINE_REASON.max + 1) }).ok).toBe(false);
  });

  test('anything else is not an answer', () => {
    expect(checkBookingResponse({ answer: 'CONFIRMED' }).ok).toBe(false);
    expect(checkBookingResponse({}).ok).toBe(false);
  });
});
