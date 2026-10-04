// The database guard (docs/wedding-os/15-record-ownership.md §4.7, central enforcement chosen 4 Oct 2026). Pure: given a model,
// an operation, its arguments and the current scope, it returns the arguments to actually run — limited to the scope's business —
// or throws. lib/prisma.ts applies it to every query on an owned table.
//
//  • reads, updates, deletes   → the business is added to `where` (a record of another business simply is not found)
//  • creates (and upsert's create) → the business is set on the new record
//  • a query that names a DIFFERENT business than the scope → refused (never silently widened or narrowed)
//  • SYSTEM scope              → unchanged (named, deliberate cross-business lookups)
import { CHILD_MODELS, OWNED_MODELS, PARENT_LINKS, type ChildModel, type OwnedModel } from './owned';
import type { Scope } from './scope';

export class ScopeViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopeViolationError';
  }
}

const OWNED = new Set<string>(OWNED_MODELS);
export const isOwnedModel = (model: string | undefined): model is OwnedModel => !!model && OWNED.has(model);
const CHILD = new Set<string>(CHILD_MODELS);
export const isChildModel = (model: string | undefined): model is ChildModel => !!model && CHILD.has(model);

// The `where` that limits a model to a business: its own column for an owned record; for a child, "any parent leads to it".
export function ownerFilter(model: OwnedModel | ChildModel, businessId: string): Record<string, unknown> {
  if (isOwnedModel(model)) return { businessId };
  const links = PARENT_LINKS[model];
  const paths = links.map((l) => ({ [l.relation]: ownerFilter(l.model, businessId) }));
  return paths.length === 1 ? paths[0] : { OR: paths };
}

function andWhere(where: unknown, extra: Record<string, unknown>): Record<string, unknown> {
  const w = (where ?? {}) as Record<string, unknown>;
  const and = w.AND === undefined ? [] : Array.isArray(w.AND) ? w.AND : [w.AND];
  return { ...w, AND: [...and, extra] };
}

// Every parent a write points at — by its column (`weddingId`) or by `connect` — so the caller can check none belongs to another
// business. Covers create, createMany, update, updateMany and both halves of upsert.
export function parentRefs(model: string, operation: string, args: Record<string, unknown> | undefined): { relation: string; model: OwnedModel | ChildModel; id: string }[] {
  if (!isOwnedModel(model) && !isChildModel(model)) return [];
  const payloads: unknown[] = [];
  if (CREATE_OPS.has(operation)) payloads.push(...(Array.isArray(args?.data) ? args.data : [args?.data]));
  if (operation === 'update' || operation === 'updateMany' || operation === 'updateManyAndReturn') payloads.push(args?.data);
  if (operation === 'upsert') payloads.push(args?.create, args?.update);
  const refs: { relation: string; model: OwnedModel | ChildModel; id: string }[] = [];
  for (const p of payloads) {
    if (!p || typeof p !== 'object') continue;
    const d = p as Record<string, unknown>;
    for (const l of PARENT_LINKS[model]) {
      const byColumn = d[l.fk];
      const byConnect = (d[l.relation] as { connect?: { id?: unknown } } | undefined)?.connect?.id;
      for (const id of [byColumn, byConnect]) if (typeof id === 'string' && id) refs.push({ relation: l.relation, model: l.model, id });
    }
  }
  return refs;
}

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
  if (scope.kind === 'SYSTEM') return args;
  if (isChildModel(model)) {
    // A child has no column of its own: reads, updates and deletes see it only through a parent of this business. Creates are
    // checked by the caller (parentRefs) — a new child may not hang off another business's record.
    const a = { ...(args ?? {}) } as Record<string, unknown>;
    if (WHERE_OPS.has(operation)) return { ...a, where: andWhere(a.where, ownerFilter(model, scope.businessId)) };
    if (CREATE_OPS.has(operation)) return args;
    throw new ScopeViolationError(`${model}.${operation} is not covered by the ownership guard`);
  }
  if (!isOwnedModel(model)) return args;
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
