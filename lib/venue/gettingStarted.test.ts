/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { buildGettingStarted, type StartFacts } from './gettingStarted';
import { effectivePermissions, type Permission } from '@/lib/auth/permissions';

const NOTHING: StartFacts = { offerings: 0, hasUpi: false, enquiries: 0, quotationsSent: 0 };
const owner = () => true;
const as = (role: 'MANAGER' | 'EMPLOYEE' | 'STAFF') => {
  const allowed = effectivePermissions({ role });
  return (p: Permission) => allowed.includes(p);
};

describe('buildGettingStarted', () => {
  test('a business that has just finished its profile: four things to do, in order, none done', () => {
    const out = buildGettingStarted(NOTHING, owner);
    expect(out.steps.map((s) => s.key)).toEqual(['PRICE_LIST', 'UPI', 'ENQUIRY', 'QUOTATION']);
    expect(out.steps.every((s) => !s.done)).toBe(true);
    expect(out).toMatchObject({ doneCount: 0, finished: false });
  });

  test('each line is done when the thing itself exists', () => {
    const out = buildGettingStarted({ offerings: 3, hasUpi: false, enquiries: 1, quotationsSent: 0 }, owner);
    expect(out.steps.map((s) => [s.key, s.done])).toEqual([['PRICE_LIST', true], ['UPI', false], ['ENQUIRY', true], ['QUOTATION', false]]);
    expect(out).toMatchObject({ doneCount: 2, finished: false });
  });

  test('everything there: finished — the list is not shown again', () => {
    expect(buildGettingStarted({ offerings: 1, hasUpi: true, enquiries: 1, quotationsSent: 1 }, owner)).toMatchObject({ doneCount: 4, finished: true });
  });

  test('a business long at work without a UPI ID still gets that one line', () => {
    const out = buildGettingStarted({ offerings: 12, hasUpi: false, enquiries: 40, quotationsSent: 25 }, owner);
    expect(out.finished).toBe(false);
    expect(out.steps.filter((s) => !s.done).map((s) => s.key)).toEqual(['UPI']);
  });

  test('a manager is never told to add a UPI ID (Settings is the owner’s)', () => {
    const out = buildGettingStarted(NOTHING, as('MANAGER'));
    expect(out.steps.map((s) => s.key)).toEqual(['PRICE_LIST', 'ENQUIRY', 'QUOTATION']);
    // … and is finished without it.
    expect(buildGettingStarted({ offerings: 1, hasUpi: false, enquiries: 1, quotationsSent: 1 }, as('MANAGER')).finished).toBe(true);
  });

  test('someone who may do none of it gets no list at all', () => {
    expect(buildGettingStarted(NOTHING, as('EMPLOYEE'))).toEqual({ steps: [], doneCount: 0, finished: true });
  });

  test('every line opens a Vendor OS screen and says why — and never says "marketplace"', () => {
    for (const s of buildGettingStarted(NOTHING, owner).steps) {
      expect(s.href.startsWith('/vendor/')).toBe(true);
      expect(s.why.length).toBeGreaterThan(10);
      expect(`${s.title} ${s.why}`.toLowerCase()).not.toContain('marketplace');
    }
  });
});
