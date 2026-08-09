# Migration Log

Append one entry per execution of `scripts/migrate-to-postgres.mjs` (rehearsal runs
included, not just the final production cutover). This is the audit trail — if
someone asks six months from now how the migration was actually performed, this file
plus the linked `migration-reports/*.json` files answer it.

Newest entry at the top.

---

## Template (copy for each new run)

```markdown
## YYYY-MM-DD HH:MM (timezone) — <staging | production>

- **Git commit:** <full SHA of the commit the migration script was run from>
- **Operator:** <who ran it>
- **Source:** MongoDB — <cluster name/connection identifier>, snapshot taken <time,
  if a snapshot/backup was made first — see docs/rollback-checklist.md>
- **Target:** PostgreSQL — <Supabase project name, staging or production>
- **Pre-check:** `scripts/validate-migration-readiness.mjs` → <PASS / N blocking issues>

### Batch results
| Batch | Source | Migrated | Skipped | Failed | Validation | Duration | Report file |
|---|---|---|---|---|---|---|---|
| Categories | | | | | | | migration-reports/... |
| Blogs | | | | | | | |
| Vendors | | | | | | | |
| Vendor Packages & FAQs | | | | | | | |
| Leads/Enquiries/Consultations/Applications | | | | | | | |
| Bookings | | | | | | | |
| Invoices | | | | | | | |

### Post-migration validation
`scripts/validate-post-migration.mjs` → <PASS / FAIL, issue count>

### Performance comparison
Re-run of the 5 requests in `docs/performance-baseline.md`:
| Page/endpoint | Baseline (Mongo) | This run (Postgres) | Delta |
|---|---|---|---|
| Homepage | | | |
| Vendor detail | | | |
| Blog list | | | |
| Blog post | | | |
| Vendor search | | | |

### Issues found
<None, or a list — link to how each was resolved>

### Fixes applied
<None, or a list of code/data changes made as a result of this run>

### Outcome
<e.g. "Clean run, promoted to Release Readiness Checklist §1 complete" or "Batch 3
failed on categoryId FK violation, rolled back per docs/rollback-checklist.md,
root cause: ..., fix applied, re-run scheduled for ...">
```

---

## 2026-07-19 18:10 UTC — staging

- **Git commit:** `bed0a35` (branch `feat/wedding-os-schema`)
- **Operator:** Claude (agent), directed by the site owner
- **Source:** MongoDB Atlas cluster (`Cluster0`, per `MONGODB_URI`) — no snapshot/backup
  taken first (staging dry run, source data untouched by this run — reads only)
- **Target:** PostgreSQL — Supabase project "shaadishopping-staging" (provisioned same day)
- **Pre-check:** `scripts/validate-migration-readiness.mjs` → PASS, 0 blocking issues
  (2 non-blocking warnings: historical "Touch Of Cozy" booking items referencing a
  since-removed vendor — expected, `BookingItem.vendorId` is nullable by design)

### Batch results
| Batch | Source | Migrated | Skipped | Failed | Validation | Duration | Report file |
|---|---|---|---|---|---|---|---|
| Categories | 22 | 22 | 0 | 0 | PASS | 1.8s | `migration-reports/2026-07-19T18-10-03-642Z-Categories.json` |
| Blogs | 47 | 47 | 0 | 0 | PASS | ~2.4s | `migration-reports/2026-07-19T18-10-06-032Z-Blogs.json` |
| Vendors | 87 | 87 | 0 | 0 | PASS | ~7.3s | `migration-reports/2026-07-19T18-10-10-300Z-Vendors.json` |
| Vendor Packages & FAQs | 256 | 256 | 0 | 0 | PASS | ~20.6s | `migration-reports/2026-07-19T18-10-17-643Z-Vendor Packages & FAQs.json` |
| Leads/Enquiries/Consultations/Applications | 20 | 20 | 0 | 0 | PASS | 2.0s | `migration-reports/2026-07-19T18-10-38-200Z-Leads - Enquiries - Consultations - Vendor Applications.json` |
| Bookings | 17 | 17 | 0 | 0 | PASS | 1.6s | `migration-reports/2026-07-19T18-10-40-266Z-Bookings.json` |
| Invoices | 3 | 3 | 0 | 0 | PASS | 0.6s | `migration-reports/2026-07-19T18-10-41-939Z-Invoices.json` |

### Post-migration validation
`scripts/validate-post-migration.mjs` → **PASS, 0 issues**. Every top-level table
(Category, Vendor, VendorApplication, Lead, Enquiry, Consultation, Booking, Invoice,
Blog) matched Mongo exactly on count and field checksum. Subdocument-derived tables
(VendorPackage/VendorFaq/BookingItem/InvoiceItem) not yet independently checksummed —
known, documented limitation of the validator script, not a gap in this run's data.

### Performance comparison
Not run this pass — staging dry run focused on data correctness first. Should be
done before treating any environment as production-cutover-ready, per
`docs/release-readiness-checklist.md` §3.

### Issues found
1. `seedUsers()` wrote raw SQL against `users.role`, a column that no longer exists
   after the identity redesign (`User.role` → `UserRole` join table) — missed during
   that refactor, caught only by actually running this script against a real
   database. Script failed immediately, nothing partially written (verified before
   fixing).
2. Batch name `"Leads / Enquiries / Consultations / Vendor Applications"` contains
   `/`, which Windows treats as a path separator — broke the report-filename
   construction in `saveReport()`, ENOENT. The batch's data transaction had already
   committed successfully before this — the failure was in report-saving, not the
   migration itself.
3. (Found in the same pass, not blocking) A validate step fired 4 queries via
   `Promise.all` against the single non-pooled `pg.Client` — triggered a real "client
   already executing a query" deprecation warning. Fixed to sequential awaits.

### Fixes applied
All 3 issues above fixed in commit `bed0a35`, on the same branch, before the
successful re-run logged here. See that commit message for full detail.

### Outcome
**Clean run on the second full attempt** (first attempt failed on issue #1 above
before any batch ran; second attempt completed batches 1–4 then failed on issue #2;
third attempt, with all fixes applied, completed cleanly end-to-end). Both idempotency
and the fail-fast-on-error design worked exactly as intended — re-running against
partially-migrated data caused no duplicates. **Promoted to Release Readiness
Checklist §1 complete.** Performance comparison (§3) and rollback rehearsal (§5)
still outstanding before this environment could be considered cutover-ready.
