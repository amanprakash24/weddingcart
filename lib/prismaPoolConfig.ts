// Pure function, kept in its own module (not inlined in lib/prisma.ts) so it's
// independently unit-testable — lib/prisma.ts has import-time side effects
// (throws if DATABASE_URL is unset, constructs a real PrismaClient/PrismaPg)
// that make it impractical to import directly in a test suite where most
// other test files permanently mock('@/lib/prisma') for the process's
// lifetime (Bun's mock.module intercepts by resolved path, not by which
// specifier reached it, so even a relative './prisma' import collides with
// an earlier file's mock of the '@/lib/prisma' alias — see lib/prisma.test.ts).
//
// max: 3 — DATABASE_URL points at Supabase's transaction-mode pooler
// (PgBouncer, port 6543), which already multiplexes connections down to a
// small backend pool. Without an explicit cap, node-postgres's Pool defaults
// to max: 10 per process; on Vercel, concurrent requests spin up separate
// serverless instances, each getting its own fresh Pool — a handful of
// concurrent instances at the default cap is enough to exceed the pooler's
// own backend limit, causing connection exhaustion (EMAXCONNSESSION). 3 (not
// 1) because several services fire multiple Prisma queries concurrently
// within a single request via Promise.all (e.g. commandCenter.service.ts,
// founderDashboard.service.ts) — max: 1 would serialize those unnecessarily.
export function buildPoolConfig(connectionString: string): { connectionString: string; max: number } {
  return { connectionString, max: 3 };
}
