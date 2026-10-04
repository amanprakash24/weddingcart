import { AsyncLocalStorage } from 'node:async_hooks';
import { PLATFORM_BUSINESS_ID } from './owned';

// Which business a piece of work runs as (docs/wedding-os/15-record-ownership.md §4.7). Set ONCE per request and read by the
// database guard (lib/ownership/guard.ts, wired into lib/prisma.ts) — no service passes a business id around, and none can forget it.
//
//   runInScope({ kind: 'BUSINESS', businessId, role }, fn)  — everything inside sees only that business's records
//   runAsSystem('proposal link lookup by token', fn)        — a deliberate, named, cross-business lookup (allowlisted in CI)
//
// Phase B: with no scope set, work runs as Shaadi Shopping — exactly today's behaviour, and safe because only staff routes run
// without one. Before any venue screen ships (Phase C) this becomes fail-closed: no scope = an error.

export type BusinessRoleName = 'OWNER' | 'STAFF';

export type Scope =
  | { kind: 'BUSINESS'; businessId: string; role: BusinessRoleName }
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

export const hasExplicitScope = (): boolean => storage.getStore() !== undefined;
