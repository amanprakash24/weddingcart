// Safety guard for the real-database tests in tests-db/ (docs/testing/testing-guide.md).
//
// Those tests create, change and delete real rows, so they must never be able to reach production:
//  - they read TEST_DATABASE_URL, never DATABASE_URL (a shell that still has DATABASE_URL pointing at
//    production, as happened once, is harmless);
//  - the production project is refused outright, even if someone lists it as allowed;
//  - the URL must positively match an allow-listed test project (staging by default).
//
// Pure, so it is unit-tested in the ordinary `bun test` run.

// Supabase project refs (not secrets — they are part of every connection URL).
export const PRODUCTION_PROJECT_REFS: readonly string[] = ['axuvgctfggczewjbxwex']; // shaadishopping-prod
export const DEFAULT_ALLOWED_TEST_PROJECT_REFS: readonly string[] = ['xlrswgsadncosezfdgbm']; // shaadishopping-staging

// Extra test projects can be added with TEST_DATABASE_ALLOWED_REFS="ref1,ref2" — but never production.
export function allowedTestRefs(extra: string | undefined = process.env.TEST_DATABASE_ALLOWED_REFS): string[] {
  const more = (extra ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_TEST_PROJECT_REFS, ...more])];
}

export function assertSafeTestDatabaseUrl(
  url: string | undefined | null,
  extraAllowed: string | undefined = process.env.TEST_DATABASE_ALLOWED_REFS
): string {
  const value = url?.trim();
  if (!value) {
    throw new Error(
      'TEST_DATABASE_URL is not set. The database tests only run against an explicit test database ' +
        '(see docs/testing/testing-guide.md); they never fall back to DATABASE_URL.'
    );
  }
  const production = PRODUCTION_PROJECT_REFS.find((ref) => value.includes(ref));
  if (production) {
    throw new Error(
      'REFUSED: TEST_DATABASE_URL points at the PRODUCTION project. The database tests write and delete real rows ' +
        'and must never run against production.'
    );
  }
  if (!allowedTestRefs(extraAllowed).some((ref) => value.includes(ref))) {
    throw new Error(
      'REFUSED: TEST_DATABASE_URL is not on the allow-list of test projects (staging by default). ' +
        'Add a dedicated test project with TEST_DATABASE_ALLOWED_REFS if you really need another one.'
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
