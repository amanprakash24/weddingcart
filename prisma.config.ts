import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// This repo keeps secrets in .env.local (see .env.example), not .env — load it
// explicitly, matching every other script in this repo (`node --env-file=.env.local ...`).
config({ path: '.env.local' });

// Prisma 7: the CLI (generate/migrate/studio) reads its connection info from
// here, not from schema.prisma. The running Next.js app does NOT use this file
// — it builds its own PrismaPg adapter in lib/prisma.ts from the same env var.
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
