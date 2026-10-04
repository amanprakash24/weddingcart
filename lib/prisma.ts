import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { buildPoolConfig, TRANSACTION_OPTIONS } from '@/lib/prismaPoolConfig';
import { ownerFilter, parentRefs, scopeQuery, ScopeViolationError } from '@/lib/ownership/guard';
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

// Parents already checked for a business. A record never changes owner (the guard refuses it), so a passed check stays true —
// caching it saves a round trip on every further write under the same wedding / quotation. Bounded; cleared when full.
const parentChecked = new Set<string>();
const PARENT_CHECK_CACHE_MAX = 10_000;
function rememberParentCheck(key: string) {
  if (parentChecked.size >= PARENT_CHECK_CACHE_MAX) parentChecked.clear();
  parentChecked.add(key);
}

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
        const scope = effectiveScope();
        const scoped = scopeQuery(model, operation, args as Record<string, unknown> | undefined, scope);
        // A write may not point at another business's record (a quotation for its customer, a guest on its wedding …). The check
        // looks for a COMMITTED parent that belongs to someone else; a parent made earlier in this same request is not visible yet
        // here, and it is already stamped with this business.
        if (scope.kind === 'BUSINESS') {
          for (const ref of parentRefs(model, operation, scoped)) {
            const key = `${scope.businessId}|${ref.model}|${ref.id}`;
            if (parentChecked.has(key)) continue;
            const delegate = (base as unknown as Record<string, { count: (a: unknown) => Promise<number> }>)[ref.model.charAt(0).toLowerCase() + ref.model.slice(1)];
            if ((await delegate.count({ where: { id: ref.id, NOT: ownerFilter(ref.model, scope.businessId) } })) > 0) {
              throw new ScopeViolationError(`${model}: its ${ref.relation} belongs to another business`);
            }
            rememberParentCheck(key);
          }
        }
        return query(scoped as typeof args);
      },
    },
  },
}) as unknown as PrismaClient;
