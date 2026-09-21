/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { dateInputValue, dueWords, isoFromDateInput, nextOverdueTaskId, planTaskGroups, type PlanTask } from './planTasks';

const NOW = new Date('2026-09-21T04:30:00.000Z'); // Mon 21 Sep 2026, India
const day = (n: number) => new Date(Date.UTC(2026, 8, 21 + n)).toISOString();
const t = (id: string, over: Partial<PlanTask> = {}): PlanTask => ({
  id, title: `Task ${id}`, description: null, status: 'PENDING', priority: 'MEDIUM', dueAt: null, completedAt: null, assignedToName: null, ...over,
});

describe('planTaskGroups', () => {
  test('overdue / today / upcoming / no date / done, each in the order a person would work through it', () => {
    const groups = planTaskGroups([
      t('late-low', { dueAt: day(-1), priority: 'LOW' }),
      t('late-old', { dueAt: day(-5), priority: 'LOW' }),
      t('today-low', { dueAt: day(0), priority: 'LOW' }),
      t('today-urgent', { dueAt: day(0), priority: 'URGENT' }),
      t('soon', { dueAt: day(2) }),
      t('later', { dueAt: day(9) }),
      t('undated-low', { priority: 'LOW' }),
      t('undated-high', { priority: 'HIGH' }),
      t('finished', { status: 'DONE', completedAt: day(-1) }),
      t('dropped', { status: 'CANCELLED', completedAt: null }),
    ], NOW);
    expect(groups.map((g) => `${g.key}: ${g.tasks.map((x) => x.id).join(',')}`)).toEqual([
      'overdue: late-old,late-low',
      'today: today-urgent,today-low',
      'upcoming: soon,later',
      'noDate: undated-high,undated-low',
      'done: finished,dropped',
    ]);
  });

  test('a group with nothing in it is left out', () => {
    expect(planTaskGroups([t('a', { dueAt: day(3) })], NOW).map((g) => g.key)).toEqual(['upcoming']);
    expect(planTaskGroups([], NOW)).toEqual([]);
  });

  test('a task due today is not overdue', () => {
    expect(planTaskGroups([t('a', { dueAt: day(0) })], NOW).map((g) => g.key)).toEqual(['today']);
  });

  test('in-progress counts as open; done and cancelled do not', () => {
    const keys = planTaskGroups([t('a', { status: 'IN_PROGRESS', dueAt: day(-1) }), t('b', { status: 'DONE', dueAt: day(-1) }), t('c', { status: 'CANCELLED', dueAt: day(-1) })], NOW).map((g) => g.key);
    expect(keys).toEqual(['overdue', 'done']);
  });

  test('tasks that only mirror a vendor are not listed — they are shown as vendors', () => {
    const groups = planTaskGroups([t('1', { title: 'Confirm booking with Lens Studio for "Photography"', priority: 'MEDIUM' }), t('2', { title: 'Assign a vendor for "Decoration"', priority: 'HIGH' }), t('3', { title: 'Confirm booking with Lens Studio', status: 'DONE' }), t('4', { title: 'Book the band' })], NOW);
    expect(groups.flatMap((g) => g.tasks.map((x) => x.title))).toEqual(['Book the band']);
  });
});

describe('dueWords', () => {
  test('plain words for every case', () => {
    expect(dueWords(t('a', { dueAt: day(0) }), NOW)).toBe('due today');
    expect(dueWords(t('a', { dueAt: day(1) }), NOW)).toBe('due tomorrow');
    expect(dueWords(t('a', { dueAt: day(6) }), NOW)).toBe('due in 6 days');
    expect(dueWords(t('a', { dueAt: day(-1) }), NOW)).toBe('1 day overdue');
    expect(dueWords(t('a', { dueAt: day(-4) }), NOW)).toBe('4 days overdue');
    expect(dueWords(t('a'), NOW)).toBeNull();
  });
});

describe('nextOverdueTaskId', () => {
  test('the most overdue open task — the one "Overdue: …" is about', () => {
    expect(nextOverdueTaskId([t('a', { dueAt: day(-1) }), t('b', { dueAt: day(-6) }), t('c', { dueAt: day(2) })], NOW)).toBe('b');
  });
  test('null when nothing is overdue', () => {
    expect(nextOverdueTaskId([t('a', { dueAt: day(2) })], NOW)).toBeNull();
  });
});

describe('date input helpers', () => {
  test('a day round-trips as midnight UTC and back', () => {
    expect(isoFromDateInput('2026-10-01')).toBe('2026-10-01T00:00:00.000Z');
    expect(dateInputValue('2026-10-01T00:00:00.000Z')).toBe('2026-10-01');
    expect(dateInputValue(null)).toBe('');
  });
  test('anything that is not a real date input value is refused', () => {
    expect(isoFromDateInput('')).toBeNull();
    expect(isoFromDateInput('01-10-2026')).toBeNull();
  });
});
