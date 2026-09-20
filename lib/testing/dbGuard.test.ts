/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import {
  DEFAULT_ALLOWED_TEST_PROJECT_REFS,
  PRODUCTION_PROJECT_REFS,
  allowedTestRefs,
  assertSafeTestDatabaseUrl,
  describeTestTarget,
} from './dbGuard';

const STAGING = 'postgresql://postgres.xlrswgsadncosezfdgbm:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
const PRODUCTION = 'postgresql://postgres.axuvgctfggczewjbxwex:secret@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
const OTHER = 'postgresql://postgres.someotherprojectref1:secret@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

describe('assertSafeTestDatabaseUrl — the database tests must never reach production', () => {
  test('accepts the staging project and returns the URL unchanged', () => {
    expect(assertSafeTestDatabaseUrl(STAGING, '')).toBe(STAGING);
  });

  test('accepts the staging direct host form too (the ref appears in the host)', () => {
    const direct = 'postgresql://postgres:secret@db.xlrswgsadncosezfdgbm.supabase.co:5432/postgres';
    expect(assertSafeTestDatabaseUrl(direct, '')).toBe(direct);
  });

  test.each([[undefined], [null], [''], ['   ']])('refuses a missing URL (%p) — there is no fallback to DATABASE_URL', (value) => {
    expect(() => assertSafeTestDatabaseUrl(value, '')).toThrow('TEST_DATABASE_URL is not set');
  });

  test('REFUSES the production project', () => {
    expect(() => assertSafeTestDatabaseUrl(PRODUCTION, '')).toThrow('PRODUCTION');
  });

  test('refuses production even when someone lists it as an allowed test project', () => {
    for (const ref of PRODUCTION_PROJECT_REFS) {
      expect(() => assertSafeTestDatabaseUrl(PRODUCTION, ref)).toThrow('PRODUCTION');
      expect(() => assertSafeTestDatabaseUrl(PRODUCTION, `${ref},${DEFAULT_ALLOWED_TEST_PROJECT_REFS[0]}`)).toThrow('PRODUCTION');
    }
  });

  test('refuses production even if the ref is buried in a longer URL (host, query string, anywhere)', () => {
    const sneaky = `${STAGING}&note=${PRODUCTION_PROJECT_REFS[0]}`;
    expect(() => assertSafeTestDatabaseUrl(sneaky, '')).toThrow('PRODUCTION');
  });

  test('refuses a project that is not on the allow-list', () => {
    expect(() => assertSafeTestDatabaseUrl(OTHER, '')).toThrow('allow-list');
  });

  test('a dedicated test project can be added through the environment variable', () => {
    expect(assertSafeTestDatabaseUrl(OTHER, 'someotherprojectref1')).toBe(OTHER);
    expect(allowedTestRefs('a, b ,,c')).toEqual([...DEFAULT_ALLOWED_TEST_PROJECT_REFS, 'a', 'b', 'c']);
  });

  test('a non-database string is refused rather than accepted', () => {
    expect(() => assertSafeTestDatabaseUrl('hello', '')).toThrow('allow-list');
  });
});

describe('describeTestTarget — safe to log', () => {
  test('shows user and host but never the password', () => {
    const text = describeTestTarget(STAGING);
    expect(text).toContain('postgres.xlrswgsadncosezfdgbm@aws-0-ap-southeast-1.pooler.supabase.com:6543');
    expect(text).not.toContain('secret');
  });

  test('does not throw on garbage', () => {
    expect(describeTestTarget('not a url')).toBe('(unparseable URL)');
  });
});
