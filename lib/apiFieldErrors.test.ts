/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { extractFieldErrors, summarizeFieldErrors } from './apiFieldErrors';

const LABELS = { ownerPhone: 'Phone number', businessName: 'Business name', ownerEmail: 'Email address' };

describe('extractFieldErrors', () => {
  test('maps a custom-message issue to its field (the exact 400 the onboarding phone bug produced)', () => {
    const payload = {
      success: false,
      error: 'Invalid request',
      issues: [{ code: 'custom', path: ['ownerPhone'], message: 'Enter a valid 10-digit Indian mobile number, e.g. 98765 43210' }],
    };
    expect(extractFieldErrors(payload, LABELS)).toEqual({
      ownerPhone: 'Enter a valid 10-digit Indian mobile number, e.g. 98765 43210',
    });
  });

  test('says a missing/empty required field the way a person would', () => {
    const payload = {
      issues: [
        { code: 'too_small', path: ['businessName'], message: 'Too small: expected string to have >=1 characters' },
        { code: 'invalid_type', path: ['ownerPhone'], message: 'Invalid input: expected string, received undefined' },
      ],
    };
    expect(extractFieldErrors(payload, LABELS)).toEqual({
      businessName: 'Business name is required',
      ownerPhone: 'Phone number is required',
    });
  });

  test('keeps the first issue per field and uses the top-level segment of nested paths', () => {
    const payload = {
      issues: [
        { code: 'invalid_format', path: ['portfolioImages', 1], message: 'Invalid URL' },
        { code: 'invalid_format', path: ['portfolioImages', 2], message: 'Second issue ignored' },
      ],
    };
    expect(extractFieldErrors(payload)).toEqual({ portfolioImages: 'Invalid URL' });
  });

  test('falls back to the raw field name when no label is provided', () => {
    const payload = { issues: [{ code: 'too_small', path: ['city'], message: 'x' }] };
    expect(extractFieldErrors(payload)).toEqual({ city: 'city is required' });
  });

  test.each([
    [null],
    [undefined],
    [{}],
    [{ success: false, error: 'Unauthorized' }],
    [{ issues: 'nope' }],
    [{ issues: [{ message: 'no path' }] }],
    [{ issues: [{ path: [], message: 'empty path' }] }],
  ])('returns no field errors for a payload without usable issues (%p)', (payload) => {
    expect(extractFieldErrors(payload, LABELS)).toEqual({});
  });
});

describe('summarizeFieldErrors', () => {
  test('lists the labels of the failing fields', () => {
    expect(summarizeFieldErrors({ ownerPhone: 'x', ownerEmail: 'y' }, LABELS)).toBe('Please fix: Phone number, Email address.');
  });

  test('is empty when nothing failed', () => {
    expect(summarizeFieldErrors({}, LABELS)).toBe('');
  });
});
