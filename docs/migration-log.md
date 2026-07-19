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

*(No runs yet as of 2026-07-19 — this file has only the template above. The first
entry gets added above this line once a Supabase staging project exists and the
first real execution happens, per `docs/release-readiness-checklist.md`.)*
