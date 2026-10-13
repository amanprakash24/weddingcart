/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { isOverdue, memberLabel, sortMyWork, workGivenMessage } from './myWork';

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

  test('the WhatsApp message "work for you": what, by when, which wedding, where to find it — no number, no money', () => {
    const full = workGivenMessage({ firstName: 'Sunil', businessName: 'Kush Travel', title: 'Check the generator fuel', dueOn: '2026-12-08', weddingName: 'Rahul Kumar', weddingDate: '2026-12-09', site: 'https://www.shaadishopping.com/' });
    expect(full).toBe(['Namaste Sunil,', 'Work for you from Kush Travel:', '• Check the generator fuel — by 8 Dec 2026', 'For: Rahul Kumar, 9 Dec 2026', 'See it and tick it done in Vivah OS → Today → Your work: https://www.shaadishopping.com/vendor/login'].join('\n'));
    const bare = workGivenMessage({ firstName: null, businessName: '', title: 'Flowers', dueOn: null, weddingName: 'KUS-WED-2026-0001', weddingDate: '2026-12-09', site: 'http://localhost:3001' });
    expect(bare.split('\n').slice(0, 3)).toEqual(['Namaste,', 'Work for you:', '• Flowers']);
    expect(full).not.toMatch(/₹|\d{10}/);
  });

  test('overdue: an open to-do whose day has passed — never one due today, undated or already done', () => {
    expect(isOverdue('2026-10-12', false, '2026-10-13')).toBe(true);
    expect(isOverdue('2026-10-13', false, '2026-10-13')).toBe(false);
    expect(isOverdue(null, false, '2026-10-13')).toBe(false);
    expect(isOverdue('2026-10-12', true, '2026-10-13')).toBe(false);
  });
});
