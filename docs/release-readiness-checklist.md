# Release Readiness Checklist

The final gate before switching the live application over to PostgreSQL. Nothing in
this checklist should be checked off from memory — each item points at the doc or
script that proves it, per the discipline this whole migration has followed (real
measurements, not intuition).

## 0. Staging environment (prerequisite — nothing below is possible without this)

**Database**
- [ ] Supabase **staging** project created — a separate project, never production
      reused as a test target
- [ ] PostgreSQL version matches what Prisma 7 supports (Supabase defaults are fine;
      confirm rather than assume)
- [ ] Automated backups enabled on the staging project, if the Supabase tier includes it

**Environment** (`.env.local`, never committed — `.env.example` documents the shape)
- [ ] `DATABASE_URL` set to the staging pooled connection string
- [ ] `DIRECT_URL` set to the staging direct connection string
- [ ] `SUPER_ADMIN_EMAIL` set to a real address (not fabricated — see
      `docs/migration-test-plan.md` "Special case — Users")
- [ ] `ADMIN_EMAIL` set to a real address

**Security**
- [ ] Strong, unique database password (not reused from anywhere else)
- [ ] IP restrictions configured if the Supabase tier/plan supports it
- [ ] Confirmed no secret ever gets committed — `.env.example` is the only tracked
      env file (fixed 2026-07-19; verify with `git ls-files | grep '\.env'` — should
      show only `.env.example`)

## 1. Migration execution (staging)

Run in this order, per `docs/migration-test-plan.md` and
`docs/rollback-checklist.md`'s pre-migration checklist:

- [ ] `scripts/validate-migration-readiness.mjs` passes with 0 blocking issues
      (re-run fresh — don't trust the 2026-07-19 result, live data changes daily)
- [ ] `scripts/migrate-to-postgres.mjs` run against staging — **this is its first
      execution ever**, treat the first run as a rehearsal even though it's already
      idempotent/transactional/batch-validated by design
- [ ] All 7 batch reports (`migration-reports/*.json`) show `validationStatus: PASS`
      — if any batch failed and the script stopped, follow
      `docs/rollback-checklist.md` before retrying, don't just re-run blind
- [ ] `scripts/validate-post-migration.mjs` passes (full cross-database count +
      checksum comparison)

## 2. Application correctness (staging)

- [ ] Point a local/staging deployment's env vars at the staging Postgres and run
      the app — repository layer (`repositories/*`, `services/*` from Milestone 2)
      gets its first real exercise against live data here
- [ ] Full pass of the Acceptance Checklist in `docs/postgres-migration-plan.md` §6
      (login, vendor pages, images, search, booking creation, admin dashboard, blog,
      vendor application + image upload, `/api/seed` inaccessible in production)

## 3. Performance

- [ ] Re-run the exact 5 requests from `docs/performance-baseline.md` against the
      staging app, place results side by side with the 2026-07-19 baseline
- [ ] Vendor search specifically re-measured — the pre-migration baseline flagged
      0.8s–4.5s variance tied to unindexed `$regex` search; confirm whether the
      move to Postgres improved it or whether the missing `pg_trgm`/full-text index
      (noted as an open gap) still needs addressing before cutover

## 4. Security (before Milestone 4, not blocking this gate)

- [ ] Both blocking items from `docs/security-checklist.md` resolved: rate limiting
      on both Credentials `authorize()` callbacks, explicit `session.maxAge`
- [ ] CSRF and cookie-flag items verified against a real login flow (couldn't be
      checked without one — now one exists)

## 5. Rollback

- [ ] Rollback procedure in `docs/rollback-checklist.md` actually rehearsed once on
      staging (redeploy `mongo-final`, confirm it serves correctly) — not just
      documented, executed at least once so the team has done it before it matters
- [ ] `mongo-final` tag still exists and still matches a promotable Vercel deployment

## 6. Team sign-off

- [ ] Migration reports (`migration-reports/*.json`) reviewed by someone other than
      whoever ran the migration
- [ ] Explicit go/no-go recorded (who approved, when) — this file or a dated note
      referencing it is that record

---

**Only after every box above is checked does production cutover (Milestone 6)
become a live option.** Milestone 4 (Authentication Transition) and Milestone 5
(module cutover) still sit between here and there per
`docs/architecture-review.md` §6 — this checklist gates the *data layer*
specifically, not the whole migration.
