/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { SERVICE_LABELS, serviceLabel } from './serviceLabels';

describe('serviceLabel', () => {
  test('known service keys become the customer-facing name', () => {
    expect(serviceLabel('venue')).toBe('Venue');
    expect(serviceLabel('photo-video')).toBe('Photography & Video');
    expect(serviceLabel('decorator')).toBe('Decorators');
    expect(serviceLabel(' catering ')).toBe('Catering');
    expect(serviceLabel('Makeup')).toBe('Makeup'); // typed text, not a stored key
  });

  test('anything else is kept as written — never an invented name', () => {
    expect(serviceLabel('Grand Ballroom — 500 guests')).toBe('Grand Ballroom — 500 guests');
    expect(serviceLabel('fireworks')).toBe('fireworks');
    expect(serviceLabel('')).toBeNull();
    expect(serviceLabel(null)).toBeNull();
  });

  test('every consultation service has a label (the 21 keys the consultation form accepts)', () => {
    expect(Object.keys(SERVICE_LABELS)).toHaveLength(21);
  });
});
