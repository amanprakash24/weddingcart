/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { effectivePermissions } from './permissions';
import { canSeeScreen, screenOf, vendorHome } from './workspaceView';

const ALL = ['today', 'enquiries', 'weddings', 'services', 'availability', 'payments', 'offerings', 'settings', 'team'];
const seen = (view: Parameters<typeof canSeeScreen>[1]) => ALL.filter((key) => canSeeScreen(key, view));

describe('what the Vendor OS menu shows in the chosen workspace', () => {
  test('the vendor’s own owner sees everything, and lands on Today — exactly as before memberships', () => {
    const owner = { permissions: effectivePermissions({ role: 'OWNER' }), ownsVendor: true };
    expect(seen(owner)).toEqual(ALL);
    expect(vendorHome(owner)).toBe('/vendor/today');
  });

  test('a manager of someone else’s business: no screens read through the owner link (they would show the WRONG business), no Settings', () => {
    const manager = { permissions: effectivePermissions({ role: 'MANAGER' }), ownsVendor: false };
    expect(seen(manager)).toEqual(['enquiries', 'availability', 'offerings']);
    expect(vendorHome(manager)).toBe('/vendor/enquiries');
  });

  test('an employee with no permissions yet has only the business profile', () => {
    const employee = { permissions: effectivePermissions({ role: 'EMPLOYEE' }), ownsVendor: false };
    expect(seen(employee)).toEqual([]);
    expect(vendorHome(employee)).toBe('/vendor/profile');
  });

  test('an owner by membership who is not the vendor’s linked owner still gets no owner-link screens', () => {
    const coOwner = { permissions: effectivePermissions({ role: 'OWNER' }), ownsVendor: false };
    expect(seen(coOwner)).toEqual(['enquiries', 'availability', 'offerings', 'settings', 'team']);
  });

  test('a path is matched to its screen; the profile and the chooser belong to none', () => {
    expect(screenOf('/vendor/today')).toBe('today');
    expect(screenOf('/vendor/enquiries/abc')).toBe('enquiries');
    expect(screenOf('/vendor/profile')).toBeNull();
    expect(screenOf('/workspace')).toBeNull();
  });
});

describe('Availability — the business’s own booked dates, by membership (12 Oct 2026)', () => {
  test('offered to whoever may see its enquiries or its weddings, in any business they work in', () => {
    expect(canSeeScreen('availability', { permissions: ['weddings'], ownsVendor: false })).toBe(true);
    expect(canSeeScreen('availability', { permissions: ['enquiries'], ownsVendor: false })).toBe(true);
    expect(canSeeScreen('availability', { permissions: ['catalog', 'tasks'], ownsVendor: false })).toBe(false);
  });

  test('a manager still lands on Enquiries', () => {
    expect(vendorHome({ permissions: effectivePermissions({ role: 'MANAGER' }), ownsVendor: false })).toBe('/vendor/enquiries');
  });
});
