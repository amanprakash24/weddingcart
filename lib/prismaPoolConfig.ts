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

// Prisma cancels an interactive transaction after 5 s by default. Every step of a transaction is a round trip to the database,
// and on the live site each round trip takes roughly 1-2 s (a serverless function talking to a distant pooler), so a transaction
// of ~15 steps such as Revise takes about 6 s. At the 5 s mark Prisma rolls the transaction back, but a statement already on its
// way still runs outside it. That is how Revise's "mark the original replaced" step was undone while its "save the new draft"
// step still ran and was refused for clashing with the original (traced live on 21 Sep 2026: steps at 0.6, 2.6, 4.7, 5.6 s).
// Give transactions realistic headroom by default; individual calls can still pass their own options.
export const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;
