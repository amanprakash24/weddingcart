import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { buildPoolConfig, TRANSACTION_OPTIONS } from '@/lib/prismaPoolConfig';
import { scopeQuery } from '@/lib/ownership/guard';
import { effectiveScope } from '@/lib/ownership/scope';

// Prisma 7 requires a driver adapter — the connection string is read here, not
// in prisma.config.ts (that file is CLI-only: generate/migrate/studio).
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Pool size capped at buildPoolConfig's max: 3 — see lib/prismaPoolConfig.ts
// for why (production connection-exhaustion fix).
const adapter = new PrismaPg(buildPoolConfig(connectionString));

declare global {
  var prismaBase: PrismaClient | undefined;
}

// Same global-cache pattern as lib/mongodb.ts — avoids exhausting Postgres
// connections across Next.js dev hot-reloads.
// transactionOptions: see TRANSACTION_OPTIONS — the 5 s default expires mid-transaction on the live site's slow round trips.
const base = global.prismaBase ?? new PrismaClient({ adapter, transactionOptions: TRANSACTION_OPTIONS });

if (process.env.NODE_ENV !== 'production') {
  global.prismaBase = base;
}

// Record ownership (docs/wedding-os/15-record-ownership.md §4.7): every query on an owned table is limited to the business of the
// current scope (lib/ownership/scope.ts), in this one place — including inside $transaction. lib/ownership/guard.ts has the rules.
// A query-only extension changes no method's arguments or results, so it is typed as the plain client: every existing
// `Prisma.TransactionClient | typeof prisma` signature stays valid, while the guard runs on every call (transactions included).
export const prisma = base.$extends({
  name: 'business-ownership',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        return query(scopeQuery(model, operation, args as Record<string, unknown> | undefined, effectiveScope()) as typeof args);
      },
    },
  },
}) as unknown as PrismaClient;
