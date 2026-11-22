/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { Role } from '@/lib/auth/roles';
import { COMPANY_FINANCIAL_ROLES, canSeeCompanyFinancials } from './financialAccess';

describe('canSeeCompanyFinancials', () => {
  test('the founder (SUPER_ADMIN) sees company financials', () => {
    expect(canSeeCompanyFinancials([Role.SUPER_ADMIN])).toBe(true);
  });

  test.each([[Role.SALES], [Role.OPERATIONS], [Role.VENDOR], [Role.CUSTOMER]])('%s does not', (role) => {
    expect(canSeeCompanyFinancials([role])).toBe(false);
  });

  test('Sales + Operations together still do not', () => {
    expect(canSeeCompanyFinancials([Role.SALES, Role.OPERATIONS])).toBe(false);
  });

  test('a person who is both founder and something else does', () => {
    expect(canSeeCompanyFinancials([Role.SALES, Role.SUPER_ADMIN])).toBe(true);
  });

  test('no roles, null or undefined: no access', () => {
    expect(canSeeCompanyFinancials([])).toBe(false);
    expect(canSeeCompanyFinancials(null)).toBe(false);
    expect(canSeeCompanyFinancials(undefined)).toBe(false);
  });

  test('only the founder role is on the list today', () => {
    expect([...COMPANY_FINANCIAL_ROLES]).toEqual([Role.SUPER_ADMIN]);
  });
});
