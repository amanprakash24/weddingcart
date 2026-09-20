/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { eventDateWords } from './eventDate';

describe('eventDateWords', () => {
  test('an exact date reads in words', () => {
    expect(eventDateWords('2026-12-05')).toBe('5 Dec 2026');
  });
  test('free text, typos and impossible dates are never shown to a customer', () => {
    for (const bad of ['20 October 20202', 'sometime in winter', '2026-02-31', '2026-13-01', '0202-10-20', '', null, undefined]) {
      expect(eventDateWords(bad as string | null | undefined)).toBeNull();
    }
  });
});
