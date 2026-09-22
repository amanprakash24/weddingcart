import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// This repo keeps secrets in .env.local (see .env.example), not .env — load it
// explicitly, matching every other script in this repo (`node --env-file=.env.local ...`).
config({ path: '.env.local' });

// Prisma 7: the CLI (generate/migrate/studio) reads its connection info from
// here, not from schema.prisma. The running Next.js app does NOT use this file
// — it builds its own PrismaPg adapter in lib/prisma.ts from the same env var.
//
// DIRECT_URL, not DATABASE_URL — .env.example's own comment says DIRECT_URL is
// "used by `prisma migrate`/deploy tooling" (this file IS that tooling), while
// DATABASE_URL is "read by the running app." This was wired to DATABASE_URL
// (the pgbouncer transaction-mode pooler) before, which is why `prisma migrate
// status`/`migrate dev` hung indefinitely after connecting — PgBouncer's
// transaction mode doesn't reliably hold the session-level advisory lock the
// migration engine takes, unlike DIRECT_URL's session-mode pooler (same host,
// port 5432 — confirmed reachable via Test-NetConnection before this change).
// Prisma 7's PrismaConfig.Datasource type has no separate `directUrl` field
// (only `url`/`shadowDatabaseUrl`), so this is the correct place to point it.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // DATABASE_URL is the pooled, transaction-mode connection (PgBouncer) the running app uses — it
  // doesn't support the session-level advisory lock the migration engine needs, which hangs the CLI
  // indefinitely (confirmed: migrate status/dev hung past 240s here with no error, only fixed by
  // switching to DIRECT_URL's session-mode pooler). The CLI only runs locally/in CI, never in the
  // request path, so this doesn't affect the app's own runtime connection in lib/prisma.ts.
  datasource: {
    url: env('DIRECT_URL'),
  },
});
