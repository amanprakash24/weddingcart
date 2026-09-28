// Safety guard for the real-database tests in tests-db/ (docs/testing/testing-guide.md).
//
// Those tests create, change and delete real rows, so they must never be able to reach production:
//  - they read TEST_DATABASE_URL, never DATABASE_URL (a shell that still has DATABASE_URL pointing at
//    production, as happened once, is harmless);
//  - every known production project is refused outright, even if someone lists it as allowed;
//  - a URL pointing at the same database as the app's own DATABASE_URL is refused;
//  - the URL must positively match a test project explicitly allowed through TEST_DATABASE_ALLOWED_REFS —
//    there is no built-in default, so a dedicated test database is always a deliberate choice.
//
// Pure, so it is unit-tested in the ordinary `bun test` run.

// Supabase project refs (not secrets — they are part of every connection URL).
// On 2026-09-27 the original production project was found deleted and the live site moved onto the former
// staging project, so BOTH refs are production now. Never move a ref out of this list without checking what
// Vercel Production's DATABASE_URL points at.
export const PRODUCTION_PROJECT_REFS: readonly string[] = [
  'xlrswgsadncosezfdgbm', // live production database since 2026-09-27 (formerly shaadishopping-staging)
  'axuvgctfggczewjbxwex', // original shaadishopping-prod (deleted) — kept in case the ref is ever reused
];

// Deliberately empty: there is no dedicated test project yet. Add one with TEST_DATABASE_ALLOWED_REFS="<ref>".
export const DEFAULT_ALLOWED_TEST_PROJECT_REFS: readonly string[] = [];

// Extra test projects can be added with TEST_DATABASE_ALLOWED_REFS="ref1,ref2" — but never production.
export function allowedTestRefs(extra: string | undefined = process.env.TEST_DATABASE_ALLOWED_REFS): string[] {
  const more = (extra ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_TEST_PROJECT_REFS, ...more])];
}

// Same database = same user, host, port and database name (the password is irrelevant).
function sameDatabase(a: string, b: string): boolean {
  try {
    const key = (u: URL) =>
      [decodeURIComponent(u.username), u.hostname, u.port || '5432', u.pathname.replace(/\/+$/, '') || '/postgres']
        .join('|')
        .toLowerCase();
    return key(new URL(a)) === key(new URL(b));
  } catch {
    return false;
  }
}

export function assertSafeTestDatabaseUrl(
  url: string | undefined | null,
  extraAllowed: string | undefined = process.env.TEST_DATABASE_ALLOWED_REFS,
  appDatabaseUrl: string | undefined = process.env.DATABASE_URL
): string {
  const value = url?.trim();
  if (!value) {
    throw new Error(
      'TEST_DATABASE_URL is not set. The database tests only run against an explicit test database ' +
        '(see docs/testing/testing-guide.md); they never fall back to DATABASE_URL.'
    );
  }
  const production = PRODUCTION_PROJECT_REFS.find((ref) => value.toLowerCase().includes(ref));
  if (production) {
    throw new Error(
      'REFUSED: TEST_DATABASE_URL points at a PRODUCTION project. The database tests write and delete real rows ' +
        'and must never run against production.'
    );
  }
  if (appDatabaseUrl?.trim() && sameDatabase(value, appDatabaseUrl.trim())) {
    throw new Error(
      'REFUSED: TEST_DATABASE_URL points at the same database as DATABASE_URL (the app database). ' +
        'Use a separate test database.'
    );
  }
  if (!allowedTestRefs(extraAllowed).some((ref) => value.includes(ref))) {
    throw new Error(
      'REFUSED: TEST_DATABASE_URL is not an allowed test database. There is no default test project — create a ' +
        'separate test database and allow it explicitly with TEST_DATABASE_ALLOWED_REFS="<project ref or host>".'
    );
  }
  return value;
}

// A log-safe description of where the tests will run — host and user, never the password.
export function describeTestTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return `${decodeURIComponent(parsed.username)}@${parsed.host}${parsed.pathname}`;
  } catch {
    return '(unparseable URL)';
  }
}
