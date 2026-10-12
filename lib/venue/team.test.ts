/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { effectivePermissions } from '@/lib/auth/permissions';
import { checkChange, checkNewMember, loginMessage, memberPermissions } from './team';

describe('checkNewMember', () => {
  test('a manager, typed the way people type', () => {
    expect(checkNewMember({ name: '  Rahul   Kumar ', mobile: '+91 98765 43210', role: 'MANAGER', jobTitle: ' Operations ', seesMoney: false })).toEqual({
      ok: true,
      value: { name: 'Rahul Kumar', mobile: '9876543210', role: 'MANAGER', jobTitle: 'Operations', seesMoney: false },
    });
  });

  test('every field that is wrong is named', () => {
    const r = checkNewMember({ name: 'R', mobile: '12345', role: 'OWNER', jobTitle: 'x'.repeat(61) });
    expect(r).toEqual({ ok: false, errors: { name: expect.any(String), mobile: expect.any(String), role: expect.any(String), jobTitle: expect.any(String) } });
  });

  test('an owner, or the old STAFF role, is never handed out from here', () => {
    expect(checkChange({ role: 'OWNER' }).ok).toBe(false);
    expect(checkChange({ role: 'STAFF' }).ok).toBe(false);
    expect(checkChange({ role: 'EMPLOYEE' })).toEqual({ ok: true, value: { role: 'EMPLOYEE', jobTitle: null, seesMoney: false } });
  });

  test('money is only on when it is exactly true', () => {
    expect(checkChange({ role: 'MANAGER', seesMoney: 'yes' })).toMatchObject({ ok: true, value: { seesMoney: false } });
  });
});

describe('memberPermissions', () => {
  test('a manager by default: nothing stored; with money: just that one grant', () => {
    expect(memberPermissions('MANAGER', false)).toEqual({ grants: [], denies: [] });
    expect(memberPermissions('MANAGER', true)).toEqual({ grants: ['view_financials'], denies: [] });
  });

  test('switching money off keeps whatever else the owner had given or taken', () => {
    const current = { grants: ['view_financials', 'team'], denies: ['catalog'] };
    const next = memberPermissions('MANAGER', false, current);
    expect(effectivePermissions({ role: 'MANAGER', ...next })).toEqual(['enquiries', 'quotations', 'weddings', 'tasks', 'team']);
  });

  test('an employee with money sees money and nothing else', () => {
    expect(effectivePermissions({ role: 'EMPLOYEE', ...memberPermissions('EMPLOYEE', true) })).toEqual(['view_financials']);
  });
});

test('the WhatsApp message has the business, where to sign in, the number and the code', () => {
  const m = loginMessage({ businessName: 'Kush Travel', personName: 'Rahul Kumar', mobile: '9876543210', code: '482913', site: 'https://www.shaadishopping.com/' });
  expect(m).toContain('Hi Rahul');
  expect(m).toContain('Kush Travel');
  expect(m).toContain('https://www.shaadishopping.com/vendor/login');
  expect(m).toContain('Mobile: 9876543210');
  expect(m).toContain('Code: 482913');
});
