/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { monthBucket, nextSequenceNumber } from './numbering';

describe('monthBucket', () => {
  test('formats PREFIX-YYYYMM- with a zero-padded month', () => {
    expect(monthBucket('QTN', new Date(2026, 8, 20))).toBe('QTN-202609-');
    expect(monthBucket('INV', new Date(2027, 0, 1))).toBe('INV-202701-');
    expect(monthBucket('QTN', new Date(2026, 11, 31))).toBe('QTN-202612-');
  });
});

describe('nextSequenceNumber — highest existing + 1, not a row count', () => {
  const bucket = 'QTN-202609-';

  test('starts at 0001 for an empty bucket', () => {
    expect(nextSequenceNumber(bucket, null)).toBe('QTN-202609-0001');
  });

  test('increments the highest existing number', () => {
    expect(nextSequenceNumber(bucket, 'QTN-202609-0007')).toBe('QTN-202609-0008');
    expect(nextSequenceNumber(bucket, 'QTN-202609-0099')).toBe('QTN-202609-0100');
  });

  test('a gap left by a deleted row never causes a duplicate (the count-based scheme did)', () => {
    // 0001, 0002, 0003 existed; 0002 was deleted → count is 2 → the old scheme would issue 0003 again.
    expect(nextSequenceNumber(bucket, 'QTN-202609-0003')).toBe('QTN-202609-0004');
  });

  test('grows past four digits instead of wrapping', () => {
    expect(nextSequenceNumber(bucket, 'QTN-202609-9999')).toBe('QTN-202609-10000');
  });

  test('refuses a number from another bucket or an unreadable suffix', () => {
    expect(() => nextSequenceNumber(bucket, 'QTN-202608-0001')).toThrow('not in bucket');
    expect(() => nextSequenceNumber(bucket, 'QTN-202609-00A1')).toThrow('Cannot read a sequence');
    expect(() => nextSequenceNumber(bucket, 'QTN-202609-')).toThrow('Cannot read a sequence');
  });
});
