import type { MemberRole, Permission } from '@/lib/auth/permissions';
import { AsyncLocalStorage } from 'node:async_hooks';
import { PLATFORM_BUSINESS_ID } from './owned';

// Which business a piece of work runs as (docs/wedding-os/15-record-ownership.md §4.7). Set ONCE per request and read by the
// database guard (lib/ownership/guard.ts, wired into lib/prisma.ts) — no service passes a business id around, and none can forget it.
//
//   runInScope({ kind: 'BUSINESS', businessId, role }, fn)  — everything inside sees only that business's records
//   runAsSystem('proposal link lookup by token', fn)        — a deliberate, named, cross-business lookup (allowlisted in CI)
//
// Every entry point sets its scope (app/api routes and server pages via platformScoped / a business scope — a CI scan enforces it).
// Work on owned records with NO scope is a bug. What happens then is set by OWNERSHIP_UNSCOPED:
//   'error' — refused (fail-closed; the target for production once its logs show no warnings)
//   'warn'  — the default: logged once per model and operation, and run as Shaadi Shopping (today's behaviour)

// The member's role in the business, and — when the entry point knows them — the person and exactly what they may do there
// (lib/auth/permissions.ts: Person → Membership → Role → Permissions). A scope without `permissions` (the platform's own entry
// points, a couple's proposal link) is judged by its role's defaults.
export type BusinessRoleName = MemberRole;

export type Scope =
  | { kind: 'BUSINESS'; businessId: string; role: BusinessRoleName; permissions?: readonly Permission[]; userId?: string }
  | { kind: 'SYSTEM'; reason: string };

const storage = new AsyncLocalStorage<Scope>();

export function runInScope<T>(scope: Scope, fn: () => T): T {
  if (scope.kind === 'BUSINESS' && !scope.businessId) throw new Error('A business scope needs a business id');
  if (scope.kind === 'SYSTEM' && !scope.reason.trim()) throw new Error('A system scope needs a reason');
  // Prisma queries are lazy: `() => prisma.x.findMany()` returns a query that only runs when awaited — which would be OUTSIDE this
  // scope. Starting it here (calling `then` inside the scope) makes it run as this scope however the caller writes it.
  return storage.run(scope, () => {
    const result = fn();
    if (result !== null && typeof result === 'object' && typeof (result as { then?: unknown }).then === 'function') {
      return (result as unknown as PromiseLike<unknown>).then((v) => v) as T;
    }
    return result;
  });
}

export const runAsSystem = <T>(reason: string, fn: () => T): T => runInScope({ kind: 'SYSTEM', reason }, fn);

export const PLATFORM_SCOPE: Scope = { kind: 'BUSINESS', businessId: PLATFORM_BUSINESS_ID, role: 'OWNER' };

// The scope the database guard applies right now.
export function effectiveScope(): Scope {
  return storage.getStore() ?? PLATFORM_SCOPE;
}

export class UnscopedAccessError extends Error {
  constructor(what: string) {
    super(`${what} ran without a business scope (OWNERSHIP_UNSCOPED=error)`);
    this.name = 'UnscopedAccessError';
  }
}

const warnedUnscoped = new Set<string>();

// The scope for a query on an owned / child record: the current one, or — when none is set — the OWNERSHIP_UNSCOPED rule.
export function scopeForOwnedQuery(model: string, operation: string, mode: string | undefined = process.env.OWNERSHIP_UNSCOPED): Scope {
  const scope = storage.getStore();
  if (scope) return scope;
  const what = `${model}.${operation}`;
  if (mode === 'error') throw new UnscopedAccessError(what);
  if (!warnedUnscoped.has(what)) {
    warnedUnscoped.add(what);
    console.warn(`[ownership] ${what} ran without a business scope — treated as Shaadi Shopping. Wrap its entry point (lib/ownership/entry.ts).`);
  }
  return PLATFORM_SCOPE;
}

export const hasExplicitScope = (): boolean => storage.getStore() !== undefined;
