/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { isOverdue, memberLabel, sortMyWork } from './myWork';

describe('"Your work" — the pure parts', () => {
  test('a member is named by their name; with none, the owner is "Owner" and anyone else is their job, then their role', () => {
    expect(memberLabel({ name: ' Sunil Kumar ', role: 'EMPLOYEE', jobTitle: 'Electrician' })).toBe('Sunil Kumar');
    expect(memberLabel({ name: null, role: 'OWNER', jobTitle: 'Anything' })).toBe('Owner');
    expect(memberLabel({ name: '  ', role: 'EMPLOYEE', jobTitle: 'Electrician' })).toBe('Electrician');
    expect(memberLabel({ name: null, role: 'MANAGER', jobTitle: null })).toBe('Manager');
  });

  test('open work first, soonest due on top and undated last; done work after it', () => {
    const items = [
      { id: 'done', done: true, dueOn: '2026-10-01' },
      { id: 'undated', done: false, dueOn: null },
      { id: 'later', done: false, dueOn: '2026-11-20' },
      { id: 'soon', done: false, dueOn: '2026-10-15' },
    ];
    expect(sortMyWork(items).map((i) => i.id)).toEqual(['soon', 'later', 'undated', 'done']);
  });

  test('overdue: an open to-do whose day has passed — never one due today, undated or already done', () => {
    expect(isOverdue('2026-10-12', false, '2026-10-13')).toBe(true);
    expect(isOverdue('2026-10-13', false, '2026-10-13')).toBe(false);
    expect(isOverdue(null, false, '2026-10-13')).toBe(false);
    expect(isOverdue('2026-10-12', true, '2026-10-13')).toBe(false);
  });
});
