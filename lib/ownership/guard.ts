// The database guard (docs/wedding-os/15-record-ownership.md §4.7, central enforcement chosen 4 Oct 2026). Pure: given a model,
// an operation, its arguments and the current scope, it returns the arguments to actually run — limited to the scope's business —
// or throws. lib/prisma.ts applies it to every query on an owned table.
//
//  • reads, updates, deletes   → the business is added to `where` (a record of another business simply is not found)
//  • creates (and upsert's create) → the business is set on the new record
//  • a query that names a DIFFERENT business than the scope → refused (never silently widened or narrowed)
//  • SYSTEM scope              → unchanged (named, deliberate cross-business lookups)
import { OWNED_MODELS, type OwnedModel } from './owned';
import type { Scope } from './scope';

export class ScopeViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopeViolationError';
  }
}

const OWNED = new Set<string>(OWNED_MODELS);
export const isOwnedModel = (model: string | undefined): model is OwnedModel => !!model && OWNED.has(model);

const WHERE_OPS = new Set([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy',
  'update', 'updateMany', 'updateManyAndReturn', 'delete', 'deleteMany', 'upsert',
]);
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);

type Args = Record<string, unknown> | undefined;

function withBusinessWhere(model: string, where: unknown, businessId: string): Record<string, unknown> {
  const w = (where ?? {}) as Record<string, unknown>;
  if ('businessId' in w && w.businessId !== businessId) {
    throw new ScopeViolationError(`${model}: query names another business`);
  }
  return { ...w, businessId };
}

function withBusinessData(model: string, data: unknown, businessId: string): Record<string, unknown> {
  const d = (data ?? {}) as Record<string, unknown>;
  const named = d.businessId ?? (d.business as { connect?: { id?: string } } | undefined)?.connect?.id;
  if (named !== undefined && named !== businessId) throw new ScopeViolationError(`${model}: cannot create a record for another business`);
  if (d.business) return d; // already connected to this business
  // Prisma has two create shapes: with relation operations (`consultation: { connect }`, `items: { create }`) only the relation form
  // `business: { connect }` is accepted; with plain columns (`consultationId`) only `businessId` is. Use whichever the data uses.
  return usesRelationWrites(d) ? { ...d, business: { connect: { id: businessId } } } : { ...d, businessId };
}

const RELATION_OPS = ['connect', 'create', 'connectOrCreate', 'createMany', 'set'];
function usesRelationWrites(data: Record<string, unknown>): boolean {
  return Object.values(data).some((v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && RELATION_OPS.some((op) => op in (v as object)));
}

export function scopeQuery(model: string, operation: string, args: Args, scope: Scope): Args {
  if (!isOwnedModel(model) || scope.kind === 'SYSTEM') return args;
  const { businessId } = scope;
  const a = { ...(args ?? {}) } as Record<string, unknown>;

  if (WHERE_OPS.has(operation)) {
    a.where = withBusinessWhere(model, a.where, businessId);
    if (operation === 'upsert') a.create = withBusinessData(model, a.create, businessId);
    // A record never changes owner (§4.3): an update may not set a different business, nor reconnect the relation.
    const changes = (operation === 'upsert' ? a.update : a.data) as Record<string, unknown> | undefined;
    if (changes && 'businessId' in changes && changes.businessId !== businessId) throw new ScopeViolationError(`${model}: cannot move a record to another business`);
    if (changes && 'business' in changes) throw new ScopeViolationError(`${model}: cannot move a record to another business`);
    return a;
  }
  if (CREATE_OPS.has(operation)) {
    a.data = Array.isArray(a.data) ? a.data.map((d) => withBusinessData(model, d, businessId)) : withBusinessData(model, a.data, businessId);
    return a;
  }
  // Any other operation on an owned table is not expected — refuse rather than guess.
  throw new ScopeViolationError(`${model}.${operation} is not covered by the ownership guard`);
}
