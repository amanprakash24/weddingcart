/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { SS_PLANNING, isShaadiShoppingBusiness, planningScope } from './ssPlanning';

describe('Shaadi Shopping planning & coordination', () => {
  test('only Shaadi Shopping records carry it — never a venue', () => {
    expect(isShaadiShoppingBusiness('shaadi-shopping')).toBe(true);
    expect(isShaadiShoppingBusiness('some-venue-id')).toBe(false);
    expect(isShaadiShoppingBusiness(null)).toBe(false);
    expect(isShaadiShoppingBusiness(undefined)).toBe(false);
  });

  test('it is always "Included" — the wording never carries a price', () => {
    expect(SS_PLANNING.included).toBe('Included');
    expect(Object.values(SS_PLANNING).join(' ')).not.toMatch(/₹|\d/);
  });

  test('scope lists each function once, or the whole wedding', () => {
    expect(planningScope(['Haldi', 'Wedding', 'Haldi', ' '])).toBe('All functions: Haldi, Wedding');
    expect(planningScope([])).toBe('Your whole wedding');
  });
});
