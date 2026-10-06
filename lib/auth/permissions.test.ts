/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { can, effectivePermissions, FINANCIAL_PERMISSIONS, grantsAndDenies, PERMISSIONS, ROLE_DEFAULTS, type MemberRole, type Permission } from './permissions';

const scope = (role: MemberRole, permissions?: Permission[]) => ({ kind: 'BUSINESS', role, permissions });

describe('role defaults — Person → Membership → Role → Permissions', () => {
  test('the owner has everything', () => {
    expect(effectivePermissions({ role: 'OWNER' })).toEqual([...PERMISSIONS]);
  });

  test('a manager runs the day-to-day work and sees NO money by default', () => {
    expect(effectivePermissions({ role: 'MANAGER' })).toEqual(['enquiries', 'quotations', 'weddings', 'tasks', 'catalog']);
    for (const money of FINANCIAL_PERMISSIONS) expect(ROLE_DEFAULTS.MANAGER).not.toContain(money);
    expect(ROLE_DEFAULTS.MANAGER).not.toContain('team');
    expect(ROLE_DEFAULTS.MANAGER).not.toContain('settings');
  });

  test('an employee starts with nothing but their own assigned work', () => {
    expect(effectivePermissions({ role: 'EMPLOYEE' })).toEqual([]);
  });

  test('the older STAFF role keeps what it always had: enquiries, quotations, weddings — not settings or money', () => {
    expect(effectivePermissions({ role: 'STAFF' })).toEqual(['enquiries', 'quotations', 'weddings']);
  });

  test('no role but the owner gets money, the team or settings by default', () => {
    for (const role of ['MANAGER', 'EMPLOYEE', 'STAFF'] as const) {
      for (const p of ['view_financials', 'edit_financials', 'team', 'settings'] as const) expect(ROLE_DEFAULTS[role]).not.toContain(p);
    }
  });
});

describe('per-person changes', () => {
  test('the owner can let one manager see money — and only that manager', () => {
    expect(effectivePermissions({ role: 'MANAGER', grants: ['view_financials'] })).toContain('view_financials');
    expect(effectivePermissions({ role: 'MANAGER', grants: ['view_financials'] })).not.toContain('edit_financials');
    expect(effectivePermissions({ role: 'MANAGER' })).not.toContain('view_financials');
  });

  test('the owner can take something away from one person', () => {
    expect(effectivePermissions({ role: 'MANAGER', denies: ['quotations'] })).toEqual(['enquiries', 'weddings', 'tasks', 'catalog']);
  });

  test('taking away wins over giving', () => {
    expect(effectivePermissions({ role: 'EMPLOYEE', grants: ['weddings'], denies: ['weddings'] })).toEqual([]);
  });

  test('an owner is never reduced', () => {
    expect(effectivePermissions({ role: 'OWNER', denies: [...PERMISSIONS] })).toEqual([...PERMISSIONS]);
  });

  test('a name that is not a permission is ignored — never granted', () => {
    expect(effectivePermissions({ role: 'EMPLOYEE', grants: ['everything', 'admin', '*', ''] })).toEqual([]);
    expect(effectivePermissions({ role: 'EMPLOYEE', grants: null, denies: null })).toEqual([]);
  });

  test('grantsAndDenies stores only the differences from the role’s defaults, and reads back to the same set', () => {
    const wanted: Permission[] = ['enquiries', 'weddings', 'tasks', 'catalog', 'view_financials'];
    const stored = grantsAndDenies('MANAGER', wanted);
    expect(stored).toEqual({ grants: ['view_financials'], denies: ['quotations'] });
    expect(effectivePermissions({ role: 'MANAGER', ...stored })).toEqual(PERMISSIONS.filter((p) => wanted.includes(p)));
    expect(grantsAndDenies('MANAGER', [...ROLE_DEFAULTS.MANAGER])).toEqual({ grants: [], denies: [] });
  });
});

describe('can — the question every server check asks', () => {
  test('an owner can do anything in their business', () => {
    for (const p of PERMISSIONS) expect(can(scope('OWNER'), p)).toBe(true);
  });

  test('a scope that carries its permissions uses exactly those', () => {
    const manager = scope('MANAGER', effectivePermissions({ role: 'MANAGER', grants: ['view_financials'], denies: ['catalog'] }));
    expect(can(manager, 'enquiries')).toBe(true);
    expect(can(manager, 'view_financials')).toBe(true);
    expect(can(manager, 'edit_financials')).toBe(false);
    expect(can(manager, 'catalog')).toBe(false);
    expect(can(manager, 'team')).toBe(false);
  });

  test('a scope with only a role falls back to that role’s defaults', () => {
    expect(can(scope('MANAGER'), 'quotations')).toBe(true);
    expect(can(scope('MANAGER'), 'view_financials')).toBe(false);
    expect(can(scope('STAFF'), 'settings')).toBe(false);
    expect(can(scope('EMPLOYEE'), 'enquiries')).toBe(false);
  });

  test('an empty permission list means none — it is not "use the defaults"', () => {
    expect(can(scope('MANAGER', []), 'enquiries')).toBe(false);
  });

  test('a scope that is not a business (a system lookup) has no permissions', () => {
    for (const p of PERMISSIONS) expect(can({ kind: 'SYSTEM' }, p)).toBe(false);
    expect(can({ kind: 'BUSINESS' }, 'enquiries')).toBe(false);
  });
});
