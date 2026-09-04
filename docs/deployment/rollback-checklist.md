# Rollback Checklist

A procedure, not just the `mongo-final` tag. Applies to Milestone 3 (data migration)
through Milestone 6 (production cutover) — anywhere a step could leave the site in a
worse state than before it started.

## What "rollback" actually means for this app

Hosting is Vercel, deployed from this repo. The Mongo-backed app and the
Postgres-backed app are **the same codebase at different points in git history** —
there's no separate infrastructure to fail over between. Concretely:
- **"Old system"** = the deployment built from `main` at tag `mongo-final`
  (commit `8b2196d`), reading `MONGODB_URI`.
- **"New system"** = a deployment built from `feat/postgres-prisma-migration` (or
  `main` after it's merged), reading `DATABASE_URL`/`DIRECT_URL`.
- **Rollback = redeploying the `mongo-final` build**, not a database failover — the
  two databases are separate instances, so rolling back the app does not by itself
  undo any writes that happened against Postgres after cutover. That's why the
  procedure below treats "reopen traffic to the new system" as a one-way door once
  real user writes have landed in Postgres, and why Milestone 3's batches truncate
  and retry rather than attempting partial fixes.

## Procedure

```
Migration/cutover step starts
        │
        ▼
Run the relevant validation
(per-batch query in docs/migration-test-plan.md,
 or scripts/validate-post-migration.mjs for the full run)
        │
        ▼
   Validation passes?
        │
   ┌────┴────┐
  YES         NO
   │           │
   ▼           ▼
Continue    ROLLBACK:
to next     1. Stop the migration script — do not proceed to the next batch
step        2. TRUNCATE the affected Postgres table(s) (see per-batch procedure
             in docs/migration-test-plan.md)
            3. If already deployed/serving traffic: redeploy the Vercel
             build tagged `mongo-final` (Vercel dashboard → Deployments →
             find the mongo-final commit → "Promote to Production", or
             `vercel rollback` if using the CLI)
            4. Confirm DATABASE_URL/DIRECT_URL env vars are NOT pointed at
             by the redeployed build (it should be reading MONGODB_URI —
             verify via /api/admin/me or any Mongo-backed route responding)
            5. Verify: manually check homepage, a vendor page, blog list,
             admin login all work against the restored build
            6. Reopen traffic (remove any maintenance-mode page/redirect)
            7. File what failed and why before retrying — don't re-run
             the same batch blind
```

## Pre-migration checklist (do before Milestone 3 starts)

- [ ] `mongo-final` tag exists and points at the last pre-migration commit — confirm
      with `git show mongo-final --stat` (already done 2026-07-19, verify still current)
- [ ] Vercel has a deployment built from `mongo-final` (or `main` at that commit)
      that can be promoted with one action — confirm this exists *before* starting,
      don't assume it can be reconstructed under pressure during an incident
- [ ] `scripts/validate-migration-readiness.mjs` passes with 0 blocking issues
      (re-run immediately before starting — data changes daily)
- [ ] A maintenance-mode mechanism exists (even a simple env-var-gated banner/redirect)
      so traffic can be paused during the real cutover window without a code deploy
- [ ] Everyone on the team knows who has Vercel deploy access and DB credentials
      *before* an incident, not during one

## Post-migration checklist (after Milestone 6 cutover, before declaring done)

- [ ] `scripts/validate-post-migration.mjs` passes (counts + checksums match)
- [ ] Full functional pass against `docs/postgres-migration-plan.md` §6 Acceptance
      Checklist
- [ ] `docs/performance-baseline.md` re-measured and compared — no regression left
      unexplained
- [ ] MongoDB instance kept running and untouched for **≥2 weeks** (per the cutover
      strategy in `docs/postgres-migration-plan.md` §3 Decision 3) before
      decommissioning — the rollback path above only works while it's still live
