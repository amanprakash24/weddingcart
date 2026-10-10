import { describe, test, expect } from 'bun:test';
import { compare, parse } from './db-snapshot.mjs';

type Snapshot = { tables: Record<string, { count: number; sum: string | null }>; migrations?: string[] };

// The before/after check of a release (docs/deployment/rollback-checklist.md §7). Only the comparison is tested here — taking a
// snapshot needs a database and is read-only by construction (BEGIN READ ONLY).
describe('db-snapshot: comparing two snapshots', () => {
  const before: Snapshot = { tables: { bookings: { count: 3, sum: 'a' }, payments: { count: 5, sum: 'b' }, login_attempts: { count: 10, sum: null } }, migrations: ['m1'] };

  test('nothing changed', () => {
    expect(compare(before, structuredClone(before))).toEqual({ total: 3, same: 3, diffs: [], newMigrations: [] });
  });

  test('a new row, a changed row, a new table and a new migration are each named', () => {
    const after: Snapshot = {
      tables: { bookings: { count: 4, sum: 'c' }, payments: { count: 5, sum: 'changed' }, login_attempts: { count: 10, sum: null }, tasks: { count: 0, sum: 'd' } },
      migrations: ['m1', 'm2'],
    };
    expect(compare(before, after)).toEqual({
      total: 4,
      same: 1,
      diffs: ['bookings: rows 3 -> 4', 'payments: same row count (5), contents differ', 'tasks: only in the second snapshot'],
      newMigrations: ['m2'],
    });
  });

  test('a table that is only counted (it changes by itself) differs only when its count does', () => {
    const after = structuredClone(before);
    after.tables.login_attempts.count = 12;
    expect(compare(before, after).diffs).toEqual(['login_attempts: rows 10 -> 12']);
  });
});

describe('db-snapshot: arguments', () => {
  test('production’s env file unless another is named; ignored columns are sorted so two snapshots compare', () => {
    expect(parse(['take', 'before'])).toEqual({ positional: ['take', 'before'], options: { env: '.env.local', ignore: [] } });
    expect(parse(['take', 'x', '--env', '.env.staging.local', '--ignore-columns', 'kind, active'])).toEqual({ positional: ['take', 'x'], options: { env: '.env.staging.local', ignore: ['active', 'kind'] } });
  });
});
