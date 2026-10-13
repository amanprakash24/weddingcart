/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { effectivePermissions } from './permissions';
import { canSeeScreen, screenOf, vendorHome } from './workspaceView';

const ALL = ['today', 'enquiries', 'weddings', 'services', 'proposals', 'availability', 'payments', 'offerings', 'settings', 'team'];
const seen = (view: Parameters<typeof canSeeScreen>[1]) => ALL.filter((key) => canSeeScreen(key, view));

describe('what the Vendor OS menu shows in the chosen workspace', () => {
  test('an owner sees everything, and lands on Today — exactly as before memberships', () => {
    const owner = { permissions: effectivePermissions({ role: 'OWNER' }) };
    expect(seen(owner)).toEqual(ALL);
    expect(vendorHome(owner)).toBe('/vendor/today');
  });

  test('a manager: the day-to-day screens of the business they work in — no Payments (money), no Settings, no Team', () => {
    const manager = { permissions: effectivePermissions({ role: 'MANAGER' }) };
    expect(seen(manager)).toEqual(['today', 'enquiries', 'weddings', 'services', 'proposals', 'availability', 'offerings']);
    expect(vendorHome(manager)).toBe('/vendor/today');
  });

  test('a manager the owner lets see money gets Payments too', () => {
    const manager = { permissions: effectivePermissions({ role: 'MANAGER', grants: ['view_financials'] }) };
    expect(seen(manager)).toContain('payments');
  });

  test('an employee with no permissions yet has Today alone (and the business profile)', () => {
    const employee = { permissions: effectivePermissions({ role: 'EMPLOYEE' }) };
    expect(seen(employee)).toEqual(['today']);
    expect(vendorHome(employee)).toBe('/vendor/today');
  });

  test('Weddings and Services go together, by the weddings permission', () => {
    expect(seen({ permissions: ['weddings'] })).toEqual(['today', 'weddings', 'services', 'proposals', 'availability']);
    expect(seen({ permissions: ['view_financials'] })).toEqual(['today', 'payments']);
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
    expect(canSeeScreen('availability', { permissions: ['weddings'] })).toBe(true);
    expect(canSeeScreen('availability', { permissions: ['enquiries'] })).toBe(true);
    expect(canSeeScreen('availability', { permissions: ['catalog', 'tasks'] })).toBe(false);
  });
});
