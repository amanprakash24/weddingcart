# Repository Contract — Milestone 2

Governs every repository/service written from Milestone 2 onward. Established now,
with `CategoryRepository`, `BlogRepository`, `VendorRepository` as the first three
(lowest-risk) implementations, before extending the pattern to leads, bookings, and
invoices.

**This code does not change user-facing behavior.** Existing Mongo-backed routes are
untouched and stay live; repositories/services are net-new, unwired code that
establishes the pattern the Milestone 5 module cutover will later route through.

## Layering

```
Route Handler → Service → Repository → Prisma
```

Never `Route Handler → Prisma` directly, and never `Repository → Repository` (if two
repositories' data needs to be combined, that composition happens in a service).

- **Route handler**: parses/validates request shape (Zod), calls a service, maps the
  result (or a thrown error) to an HTTP response. No Prisma imports, no business logic.
- **Service**: business rules, cross-repository composition, transaction boundaries.
  Calls one or more repositories. This is where "can this application be approved
  twice?"-type questions get answered.
- **Repository**: one per Prisma model. Thin — translates a caller's intent
  (`findById`, `create`, …) into a `prisma.<model>.*` call and typed error handling.
  No business logic, no validation beyond what the DB itself enforces.

## Standard interface

Every repository exposes the same base shape unless there's a real domain reason not
to (documented inline when that happens, not silently varied):

```ts
interface BaseRepository<T, CreateInput, UpdateInput, WhereInput> {
  findById(id: string, tx?: PrismaTx): Promise<T | null>;
  findMany(
    params: { where?: WhereInput; skip?: number; take?: number; orderBy?: unknown },
    tx?: PrismaTx
  ): Promise<{ data: T[]; total: number }>;
  create(data: CreateInput, tx?: PrismaTx): Promise<T>;
  update(id: string, data: UpdateInput, tx?: PrismaTx): Promise<T>;
  delete(id: string, tx?: PrismaTx): Promise<T>;
}
```

Domain-specific additions are fine (`findBySlug` on `Category`/`Vendor`/`Blog`,
matching the slug-based lookups the current Mongo API already does) — the rule is
consistency for the common cases, not a rigid interface no repository may extend.

Every method accepts an **optional trailing `tx` parameter** (a Prisma transaction
client) so services can compose multiple repository calls atomically. When omitted,
repositories use the shared `prisma` singleton from `lib/prisma.ts`.

## Answers to the open questions

**Which layer owns transactions?**
Services. A service method needing atomicity across repositories wraps the calls in
`prisma.$transaction(async (tx) => { ... })` and threads `tx` through to each
repository call. Repositories never open their own transactions — they're
transaction-agnostic, just accept an optional client. (First real use case:
`VendorApplicationService.approve()` in a later milestone, which must create a
`Vendor` and update the `VendorApplication` atomically.)

**How are pagination and filtering handled?**
`findMany()` takes a Prisma-shaped `where` clause and `{ skip, take }`, and returns
raw `{ data, total }` — no response envelope. Building the `where` clause from
user-facing query params (e.g. `?category=venue&city=Patna`) is a **service**
responsibility, since it requires domain knowledge (which query params exist, how
they map to fields). Turning `{ data, total }` into the API response envelope
(`{ data, pagination: { page, limit, total, totalPages } }` per
`docs/architecture-review.md` §3) is a **route handler** responsibility.

**Where is validation performed?**
- Route handler: request *shape* only (Zod) — required fields present, correct types.
- Service: business *rules* — e.g. "an application already in `APPROVED` status can't
  be approved again." Requires domain knowledge and sometimes a DB read, so it can't
  live in the route handler or the repository.
- Repository: none. Trusts its input; the only validation it performs is whatever the
  database itself enforces (constraints, FKs).

**What errors may repositories throw?**
Repositories catch known Prisma error codes and rethrow as typed domain errors
(`lib/errors.ts`): `P2025` (record not found) → `NotFoundError`; `P2002` (unique
constraint) → `DuplicateError` (carries the field name). Anything else — connection
failures, unrecognized codes — propagates unwrapped; repositories never silently
swallow an unexpected error. Services may throw their own business-rule errors
(e.g. `InvalidStateTransitionError`) independent of repository errors. Route handlers
catch typed errors via one shared `handleApiError()` helper and map them to HTTP
status (`NotFoundError`→404, `DuplicateError`→409, Zod validation→400, anything
uncaught→500) — that mapping lives in one place, not repeated per route.

**Which layer converts DB models into API responses?**
The route handler (directly, or via a thin serializer it calls). Repositories and
services return Prisma-generated types as-is. **Hard rule, security-relevant even
though `UserRepository` isn't built this milestone:** `User.passwordHash` must never
be returned from any method intended for API exposure — use a Prisma `select` that
omits it, don't rely on the route handler to remember to strip it.

## Rollout order

1. `CategoryRepository` / `CategoryService`
2. `BlogRepository` / `BlogService`
3. `VendorRepository` / `VendorService`

Only once these three feel right — consistent interface, transaction pattern proven,
error handling working — does the same pattern extend to `Lead`, `Booking`, `Invoice`
in a later milestone.
