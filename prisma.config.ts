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
  datasource: {
    url: env('DATABASE_URL'),
  },
});
