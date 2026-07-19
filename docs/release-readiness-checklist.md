# Release Readiness Checklist

The final gate before switching the live application over to PostgreSQL. Nothing in
this checklist should be checked off from memory — each item points at the doc or
script that proves it, per the discipline this whole migration has followed (real
measurements, not intuition).

## 0. Staging environment (prerequisite — nothing below is possible without this)

**Database**
- [x] Supabase **staging** project created (`shaadishopping-staging`, 2026-07-19) —
      a separate project, not production reused as a test target
- [x] PostgreSQL version confirmed directly (not assumed): 17.6
- [ ] Automated backups enabled on the staging project — **not yet verified**

**Environment** (`.env.local`, never committed — `.env.example` documents the shape)
- [x] `DATABASE_URL` set — **using the direct connection for both** `DATABASE_URL`/
      `DIRECT_URL` (not the pooled string), a deliberate simplification for a
      no-concurrent-traffic staging dry run — switch `DATABASE_URL` to the pooled
      (port 6543) string before anything resembling real load
- [x] `DIRECT_URL` set (same direct connection string, see above)
- [x] `SUPER_ADMIN_EMAIL` set to a real address
- [x] `ADMIN_EMAIL` set to a real address

**Security**
- [x] Strong, unique database password (Supabase-generated, not reused)
- [ ] IP restrictions — **not configured** (Free tier default: open; revisit before
      anything beyond a staging dry run)
- [x] Confirmed no secret ever gets committed — `.env.example` is the only tracked
      env file

## 1. Migration execution (staging)

- [x] `scripts/validate-migration-readiness.mjs` passes with 0 blocking issues
      (re-run fresh 2026-07-19 immediately before the real run, not the earlier
      2026-07-19 morning result — counts had already shifted: 87 vendors vs. 93 earlier)
- [x] `scripts/migrate-to-postgres.mjs` run against staging (2026-07-19,
      commit `bed0a35`) — **first execution surfaced 2 real bugs**, both fixed (see
      `docs/migration-log.md` for full detail: a stale `users.role` reference from
      the identity redesign, and a Windows filename bug from `/` in a batch name).
      Third attempt, with fixes applied, completed cleanly end-to-end.
- [x] All 7 batch reports (`migration-reports/*.json`) show `validationStatus: PASS`
- [x] `scripts/validate-post-migration.mjs` passes — **0 mismatches** across every
      checked table (Category, Vendor, VendorApplication, Lead, Enquiry,
      Consultation, Booking, Invoice, Blog)

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
