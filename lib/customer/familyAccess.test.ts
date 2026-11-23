import { describe, expect, it } from 'bun:test';
import { can, familyMemberProblem } from './familyAccess';

describe('family access rules', () => {
  it('the couple can do everything', () => {
    for (const p of ['view', 'plan', 'money', 'family'] as const) expect(can('OWNER', p)).toBe(true);
  });
  it('full access: everything but managing family', () => {
    expect([can('FULL', 'view'), can('FULL', 'plan'), can('FULL', 'money'), can('FULL', 'family')]).toEqual([true, true, true, false]);
  });
  it('helps with planning: plan, never money', () => {
    expect([can('PLANNING', 'view'), can('PLANNING', 'plan'), can('PLANNING', 'money'), can('PLANNING', 'family')]).toEqual([true, true, false, false]);
  });
  it('can see the plan: view only', () => {
    expect([can('VIEW', 'view'), can('VIEW', 'plan'), can('VIEW', 'money'), can('VIEW', 'family')]).toEqual([true, false, false, false]);
  });
});

describe('adding a family member', () => {
  const ok = { name: 'Ramesh Anand', mobile: '9876543210', relation: "Groom's father", role: 'FULL' };
  it('a complete member passes', () => {
    expect(familyMemberProblem(ok, '9876543210')).toBeNull();
    expect(familyMemberProblem({ ...ok, relation: null, role: 'VIEW' }, '9876543210')).toBeNull();
  });
  it('name, mobile, relation and role are checked', () => {
    expect(familyMemberProblem({ ...ok, name: ' ' }, '9876543210')).toContain('name');
    expect(familyMemberProblem(ok, null)).toContain('10-digit');
    expect(familyMemberProblem({ ...ok, relation: 'x'.repeat(61) }, '9876543210')).toContain('60');
    expect(familyMemberProblem({ ...ok, role: 'OWNER' }, '9876543210')).toContain('Choose what they can do');
  });
});
