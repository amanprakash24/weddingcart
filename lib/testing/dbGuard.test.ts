/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import {
  DEFAULT_ALLOWED_TEST_PROJECT_REFS,
  PRODUCTION_PROJECT_REFS,
  allowedTestRefs,
  assertSafeTestDatabaseUrl,
  describeTestTarget,
} from './dbGuard';

// The live database (formerly "staging") in both of its connection forms, and the deleted original production project.
const LIVE_POOLER = 'postgresql://postgres.xlrswgsadncosezfdgbm:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
const LIVE_DIRECT = 'postgresql://postgres:secret@db.xlrswgsadncosezfdgbm.supabase.co:5432/postgres';
const OLD_PRODUCTION = 'postgresql://postgres.axuvgctfggczewjbxwex:secret@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
// A separate, dedicated test project — only usable once explicitly allowed.
const TEST_DB = 'postgresql://postgres.someotherprojectref1:secret@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
const TEST_REF = 'someotherprojectref1';

describe('assertSafeTestDatabaseUrl — the database tests must never reach production', () => {
  test('both the live database and the deleted original production project are production', () => {
    expect(PRODUCTION_PROJECT_REFS).toContain('xlrswgsadncosezfdgbm');
    expect(PRODUCTION_PROJECT_REFS).toContain('axuvgctfggczewjbxwex');
  });

  test('REFUSES the live database — pooler and direct connection forms', () => {
    expect(() => assertSafeTestDatabaseUrl(LIVE_POOLER, '', '')).toThrow('PRODUCTION');
    expect(() => assertSafeTestDatabaseUrl(LIVE_DIRECT, '', '')).toThrow('PRODUCTION');
  });

  test('REFUSES the original production project', () => {
    expect(() => assertSafeTestDatabaseUrl(OLD_PRODUCTION, '', '')).toThrow('PRODUCTION');
  });

  test('refuses production even when someone lists it as an allowed test project', () => {
    for (const ref of PRODUCTION_PROJECT_REFS) {
      expect(() => assertSafeTestDatabaseUrl(LIVE_POOLER, ref, '')).toThrow('PRODUCTION');
      expect(() => assertSafeTestDatabaseUrl(OLD_PRODUCTION, `${ref},${TEST_REF}`, '')).toThrow('PRODUCTION');
    }
  });

  test('refuses production even if the ref is buried in a longer URL, in any letter case', () => {
    expect(() => assertSafeTestDatabaseUrl(`${TEST_DB}&note=${PRODUCTION_PROJECT_REFS[0]}`, TEST_REF, '')).toThrow('PRODUCTION');
    expect(() => assertSafeTestDatabaseUrl(LIVE_DIRECT.toUpperCase(), '', '')).toThrow('PRODUCTION');
  });

  test.each([[undefined], [null], [''], ['   ']])('refuses a missing URL (%p) — there is no fallback to DATABASE_URL', (value) => {
    expect(() => assertSafeTestDatabaseUrl(value, TEST_REF, '')).toThrow('TEST_DATABASE_URL is not set');
  });

  test('there is no default test project: an unlisted database is refused', () => {
    expect(DEFAULT_ALLOWED_TEST_PROJECT_REFS).toEqual([]);
    expect(() => assertSafeTestDatabaseUrl(TEST_DB, '', '')).toThrow('not an allowed test database');
  });

  test('refuses a URL that points at the same database as the app\'s DATABASE_URL (password ignored)', () => {
    const appUrl = TEST_DB.replace(':secret@', ':another-password@');
    expect(() => assertSafeTestDatabaseUrl(TEST_DB, TEST_REF, appUrl)).toThrow('same database as DATABASE_URL');
  });

  test('accepts a separate, explicitly allowed test database and returns the URL unchanged', () => {
    expect(assertSafeTestDatabaseUrl(TEST_DB, TEST_REF, LIVE_POOLER)).toBe(TEST_DB);
    expect(assertSafeTestDatabaseUrl(TEST_DB, TEST_REF, undefined)).toBe(TEST_DB);
  });

  test('a different database on the same host as DATABASE_URL is not treated as the same database', () => {
    const local = 'postgresql://tester:pw@localhost:5432/weddingcart_test';
    expect(assertSafeTestDatabaseUrl(local, 'weddingcart_test', 'postgresql://app:pw@localhost:5432/weddingcart')).toBe(local);
  });

  test('allow-list parsing trims and drops empty entries', () => {
    expect(allowedTestRefs('a, b ,,c')).toEqual(['a', 'b', 'c']);
  });

  test('a non-database string is refused rather than accepted', () => {
    expect(() => assertSafeTestDatabaseUrl('hello', '', '')).toThrow('not an allowed test database');
  });
});

describe('describeTestTarget — safe to log', () => {
  test('shows user and host but never the password', () => {
    const text = describeTestTarget(TEST_DB);
    expect(text).toContain('postgres.someotherprojectref1@aws-0-ap-south-1.pooler.supabase.com:5432');
    expect(text).not.toContain('secret');
  });

  test('does not throw on garbage', () => {
    expect(describeTestTarget('not a url')).toBe('(unparseable URL)');
  });
});
