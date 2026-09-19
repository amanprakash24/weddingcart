# Testing guide

How this repository is tested, what each layer proves, and how to run the real-database suite safely.

## Layers

| Layer | Command | Needs a database | What it proves |
|---|---|---|---|
| Unit / service tests | `bun test` | No | Pure rules (totals, state machine, numbering, message building) and service logic with `@/lib/prisma` mocked. ~550 tests, ~1 s. |
| Real-database tests | `bun run test:db` | **Yes — a dedicated test database** | Things a mock cannot prove: unique indexes, CHECK constraints, advisory locks, transaction rollback, real concurrency, and the Golden Wedding flow through the real services. |
| Type / lint / build | `npx tsc --noEmit`, `bun run lint`, `bun run build` | No | Compile-time correctness. Lint has a known baseline (55 problems: 11 errors, 44 warnings) — do not add to it. |

`bun test` (no arguments) **skips** the real-database files even if `TEST_DATABASE_URL` is set: unit-test files mock `@/lib/prisma` for the whole Bun process, so the real services could not reach a database anyway. The database tests run only when asked for by path, which `bun run test:db` does.

## Running the real-database suite

```bash
# bash
export TEST_DATABASE_URL='postgresql://…'   # a staging/test database — see the safety rules below
bun run test:db
```

```powershell
# PowerShell
$env:TEST_DATABASE_URL = 'postgresql://…'
bun run test:db
```

Expect roughly 4 minutes against a remote database: every step is a network round trip, and concurrency tests fan out. The script passes `--timeout 180000` (Bun's default is 5 s, far too short; a test that times out keeps running in the background and starves the next ones of connections).

Without `TEST_DATABASE_URL` the suite is skipped cleanly, not failed.

## Safety rules (enforced in code, `lib/testing/dbGuard.ts`)

The guard runs before anything imports Prisma. It **refuses** to run when:

1. `TEST_DATABASE_URL` is unset — the suite never falls back to `DATABASE_URL`, so a developer's shell or `.env` cannot be hit by accident;
2. the URL contains the **production** project ref, *even if someone adds it to the allow-list*;
3. the project ref is not on the allow-list (`DEFAULT_ALLOWED_TEST_PROJECT_REFS`, extendable through the guard's `extraAllowed` argument).

`loadApp()` then sets `process.env.DATABASE_URL` to the checked URL before importing any service, so the app code can only bind to the test database. The guard has its own unit tests (`lib/testing/dbGuard.test.ts`, run by plain `bun test`).

### Data hygiene

- Every row the tests create is tagged `[[dbtest]]` (`tests-db/helpers/fixtures.ts`), created fresh per test, and purged before and after each file (invoices → weddings → bookings → quotations → activity logs → tasks → consultations).
- `quotation.constraints.test.ts` works inside one transaction that is always rolled back.
- Tests never rely on, or modify, pre-existing rows. After a run the row counts of the database must equal what they were before — check this when you change fixtures.
- Never point the suite at production. There is no override.

## What is in `tests-db/`

| File | Covers |
|---|---|
| `quotation.constraints.test.ts` | DB-level guarantees: exactly-one-source, money identity CHECK, one open / one accepted quotation per source, RESTRICT delete, line-item CHECK, one Booking per quotation. |
| `quotation.concurrency.test.ts` | 3-way races on create / send / accept / revise / create-booking (exactly one winner, clean 409 for the rest); 8 parallel invoice numbers; delete-then-next-number; two weddings converting at once; a double-clicked "confirm"; forced failure of the advance invoice rolls back the whole conversion and a retry succeeds. |
| `quotation.lifecycle.test.ts` | Server-verified `QUOTATION_SENT → WON`; stage advance on send; expiry (lazy and on accept); revise / discard; booking rules (price, quantity, dates, one booking); source locked after conversion. |
| `golden-wedding.test.ts` | The 16-step Golden Wedding (Rahul & Priya, ₹5,00,000): consultation → quotation (sent, accepted) → booking → wedding → advance invoice ₹2,00,000 (no tax) → payment via the webhook handler (including failed-then-success and duplicate / concurrent webhooks) → balance invoice → vendor confirmations → overdue-task effect on the Command Center. |

## The gap list (`test.todo`)

`golden-wedding.test.ts` ends with `gap(...)` entries — steps of the Golden Wedding that **cannot pass yet because the feature is not built**. They show as `todo` in the run, not as passes, so a missing feature is visible instead of silently untested. When a feature lands, turn its `gap()` into a real test in the same PR.

| Gap | Audit reference |
|---|---|
| Add further wedding events (Haldi, Mehendi, Sangeet) after conversion | P0-2 |
| Record a cash / UPI / bank-transfer payment | P0-5 |
| Command Center lists an unpaid wedding invoice as due (today only non-DRAFT invoices count, and creating a payment link leaves the invoice DRAFT) | finding from S5 |
| Availability: two bookings for the same venue and date — exactly one wins | P0-3 |
| Completion guard: unpaid balance / open tasks / unconfirmed vendors block COMPLETED | P0-4 |
| Documents: attach a contract to a wedding, isolated from other weddings | P1 |
| Notifications: the venue owner is told about a new booking | P1 |

## Writing new database tests

- Import from `./helpers/app` (`dbDescribe`, `loadApp`, `tally`, `inDays`) and `./helpers/fixtures`; never import `@/lib/prisma` or a service at the top of the file — it would bind to whatever `DATABASE_URL` is in the environment before the guard runs.
- Create data through the fixtures so it is tagged and purged.
- **Do not use `expect(promise).rejects.toThrow()`** against these services under Bun: it hung for the full timeout on a Prisma-backed rejection. Capture the error instead: `const error = await call.then(() => null, (e: Error) => e)` and assert on `error?.name` / `error?.message`.
- Assert what really happens, not what you expect from another path. Example: the booking → wedding path seeds one confirmation task per vendor booking; the umbrella "Confirm venue & vendor bookings" task and milestones come only from the CRM path.
- Keep concurrency fan-out modest (3–8). The pool is small and the pooler is remote; more proves nothing extra.
