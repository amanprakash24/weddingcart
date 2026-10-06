/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { codeNeedsReminder, generateLoginCode, isGuessableCode, isWellFormedCode, normalizeMobile, validateCodeChange } from './vendorCode';

describe('isWellFormedCode', () => {
  test('exactly six digits, as text', () => {
    for (const ok of ['482913', '000417', '999999']) expect(isWellFormedCode(ok)).toBe(true);
    for (const bad of ['48291', '4829134', '48 913', '48291a', '', null, undefined, 482913]) expect(isWellFormedCode(bad)).toBe(false);
  });
});

describe('normalizeMobile — the number as the login stores it', () => {
  test('accepts what people type', () => {
    for (const typed of ['9876543210', '98765 43210', '+91 98765 43210', '+91-98765-43210', '919876543210', '09876543210']) expect(normalizeMobile(typed)).toBe('9876543210');
  });

  test('anything that is not an Indian mobile number is refused', () => {
    for (const bad of ['', '12345', '5876543210', '98765432101', '+1 415 555 0100', null, undefined, 9876543210]) expect(normalizeMobile(bad)).toBeNull();
  });
});

describe('isGuessableCode', () => {
  test('one digit repeated, or a straight run up or down', () => {
    for (const weak of ['000000', '111111', '999999', '123456', '012345', '456789', '654321', '987654']) expect(isGuessableCode(weak)).toBe(true);
  });

  test('ordinary codes are fine — including ones that merely contain a run or a repeat', () => {
    for (const fine of ['482913', '112233', '123457', '121212', '100000', '135790']) expect(isGuessableCode(fine)).toBe(false);
  });
});

describe('generateLoginCode', () => {
  test('six digits, zero-padded, from the random source it is given', () => {
    expect(generateLoginCode(() => 417)).toBe('000417');
    expect(generateLoginCode(() => 482913)).toBe('482913');
  });

  test('asks the random source for one of a million values', () => {
    const asked: number[] = [];
    generateLoginCode((max) => (asked.push(max), 5));
    expect(asked).toEqual([1_000_000]);
  });

  test('a guessable draw is thrown away and drawn again', () => {
    const draws = [111111, 123456, 0, 654321, 730518];
    expect(generateLoginCode(() => draws.shift()!)).toBe('730518');
    expect(draws).toEqual([]);
  });
});

describe('validateCodeChange — the vendor changing their own code', () => {
  const good = { current: '482913', next: '730518', confirm: '730518' };

  test('a good change has nothing to report', () => {
    expect(validateCodeChange(good)).toBeNull();
  });

  test('each box gets its own sentence', () => {
    expect(validateCodeChange({})).toEqual({ current: expect.any(String), next: expect.any(String) });
    expect(validateCodeChange({ ...good, current: '4829' })).toEqual({ current: 'Enter your current 6-digit code' });
    expect(validateCodeChange({ ...good, next: '73051', confirm: '73051' })).toEqual({ next: 'Choose a code of exactly 6 digits' });
    expect(validateCodeChange({ ...good, confirm: '730519' })).toEqual({ confirm: 'The two new codes do not match' });
  });

  test('a guessable code, or the same code again, is refused', () => {
    expect(validateCodeChange({ current: '482913', next: '111111', confirm: '111111' })?.next).toContain('too easy to guess');
    expect(validateCodeChange({ current: '482913', next: '482913', confirm: '482913' })?.next).toContain('different from your current');
  });

  test('a bad new code is reported once — not also as "do not match"', () => {
    expect(validateCodeChange({ current: '482913', next: '123456', confirm: 'something else' })).toEqual({ next: expect.any(String) });
  });
});

describe('codeNeedsReminder', () => {
  const now = new Date('2026-11-05T10:00:00Z');
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  test('from the 30th day on', () => {
    expect(codeNeedsReminder(daysAgo(29), now)).toBe(false);
    expect(codeNeedsReminder(daysAgo(30), now)).toBe(true);
    expect(codeNeedsReminder(daysAgo(200), now)).toBe(true);
  });

  test('never for a login with no code', () => {
    expect(codeNeedsReminder(null, now)).toBe(false);
    expect(codeNeedsReminder(undefined, now)).toBe(false);
  });
});
