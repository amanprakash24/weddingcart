/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { INDIAN_MOBILE_ERROR, normalizeIndianMobile } from './indianPhone';

describe('normalizeIndianMobile', () => {
  test.each([
    ['9876543210', '9876543210'],
    ['98765 43210', '9876543210'],
    ['98765-43210', '9876543210'],
    ['+91 98765 43210', '9876543210'], // the onboarding form's own placeholder
    ['+919876543210', '9876543210'],
    ['919876543210', '9876543210'],
    ['09876543210', '9876543210'],
    ['  +91-98765-43210  ', '9876543210'],
    ['(+91) 98765 43210', '9876543210'],
  ])('accepts %p and returns the bare 10 digits', (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  test.each([
    ['', 'empty'],
    ['12345', 'too short'],
    ['987654321', '9 digits'],
    ['98765432101', '11 digits not starting with 0'],
    ['+1 415 555 2671', 'a non-Indian number'],
    ['5876543210', 'starts with 5 — Indian mobiles start 6-9'],
    ['0123456789', 'leading 0 then a non-mobile number'],
    ['abcdefghij', 'letters only'],
    ['+91 98765 4321', 'one digit short after +91'],
  ])('rejects %p (%s)', (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });

  test('the shown error message tells people what a valid number looks like', () => {
    expect(INDIAN_MOBILE_ERROR).toContain('10-digit');
    expect(INDIAN_MOBILE_ERROR).toContain('98765 43210');
  });
});
