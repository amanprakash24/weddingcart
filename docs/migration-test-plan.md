# Migration Test Plan

Per-dataset verification plan for the Milestone 3 data migration
(`scripts/migrate-to-postgres.mjs`, not yet written). Source counts below are real,
captured 2026-07-19 against live MongoDB via `scripts/validate-migration-readiness.mjs`
and a supplementary subdocument count query — not placeholders. **Re-capture these
counts immediately before the real migration run**, since live data changes daily;
treat the numbers here as "what they were when this plan was written," not a frozen
target.

Migration runs in 7 batches, in dependency order (a batch never migrates before the
tables it references). Validate after every batch; **do not start the next batch if
validation fails.**

---

## Batch 1 — Categories

| | |
|---|---|
| Source count (Mongo `categories`) | 22 |
| Expected destination count (Postgres `categories`) | 22 |
| Validation query | `SELECT COUNT(*) FROM categories;` → 22. Also: `SELECT slug FROM categories GROUP BY slug HAVING COUNT(*) > 1;` → 0 rows (slug uniqueness) |
| Rollback procedure | `TRUNCATE categories CASCADE;` (safe — nothing downstream migrated yet at this point in the batch order) |
| Owner | _(assign)_ |

## Batch 2 — Blogs

| | |
|---|---|
| Source count (Mongo `blogs`) | 47 |
| Expected destination count (Postgres `blogs`) | 47 |
| Validation query | `SELECT COUNT(*) FROM blogs;` → 47. `SELECT slug FROM blogs GROUP BY slug HAVING COUNT(*) > 1;` → 0 rows |
| Rollback procedure | `TRUNCATE blogs;` (no FK dependents) |
| Owner | _(assign)_ |

## Batch 3 — Vendors

| | |
|---|---|
| Source count (Mongo `vendors`) | 93 |
| Expected destination count (Postgres `vendors`) | 93 |
| Validation query | `SELECT COUNT(*) FROM vendors;` → 93. `SELECT slug FROM vendors GROUP BY slug HAVING COUNT(*) > 1;` → 0 rows. `SELECT COUNT(*) FROM vendors v LEFT JOIN categories c ON v."categoryId" = c.id WHERE c.id IS NULL;` → 0 (no orphaned FKs — confirmed clean 2026-07-19 after the `bridal-jewellery` fix, but re-check, since live data changes daily) |
| Rollback procedure | `TRUNCATE vendors CASCADE;` (cascades `vendor_packages`, `vendor_faqs` if Batch 4 already ran — re-run Batch 4 after) |
| Owner | _(assign)_ |

## Batch 4 — Vendor Packages / Vendor FAQs

| | |
|---|---|
| Source count | 252 packages, 23 FAQs (summed from `vendors[].packages[]` / `vendors[].faqs[]` across all 93 vendors) |
| Expected destination count | `SELECT COUNT(*) FROM vendor_packages;` → 252. `SELECT COUNT(*) FROM vendor_faqs;` → 23 |
| Validation query | `SELECT COUNT(*) FROM vendor_packages vp LEFT JOIN vendors v ON vp."vendorId" = v.id WHERE v.id IS NULL;` → 0 (same for `vendor_faqs`) |
| Rollback procedure | `TRUNCATE vendor_packages; TRUNCATE vendor_faqs;` — vendors row itself is untouched, safe to re-run this batch alone |
| Owner | _(assign)_ |

## Batch 5 — Leads / Enquiries / Consultations / Vendor Applications

| | |
|---|---|
| Source counts | Leads: 0 · Enquiries: 1 (down from 4 — 3 confirmed test documents deleted 2026-07-19, see `docs/migration-readiness-report.md`) · Consultations: 16 · Vendor Applications: 2 |
| Expected destination counts | `leads`: 0 · `enquiries`: 1 · `consultations`: 16 · `vendor_applications`: 2 |
| Validation query | `SELECT COUNT(*) FROM enquiries e LEFT JOIN vendors v ON e."vendorId" = v.id WHERE v.id IS NULL;` → 0. `SELECT COUNT(*) FROM vendor_applications va LEFT JOIN categories c ON va."categoryId" = c.id WHERE c.id IS NULL;` → 0 |
| Rollback procedure | `TRUNCATE leads; TRUNCATE enquiries; TRUNCATE consultations; TRUNCATE vendor_applications;` |
| Owner | _(assign)_ |

## Batch 6 — Bookings

| | |
|---|---|
| Source count | 8 bookings, 9 booking items |
| Expected destination count | `bookings`: 8 · `booking_items`: 9 |
| Validation query | `SELECT COUNT(*) FROM booking_items bi LEFT JOIN bookings b ON bi."bookingId" = b.id WHERE b.id IS NULL;` → 0. Note: `booking_items.vendorId` is **expected** to be NULL/dangling for the 2 known "Touch Of Cozy" historical rows (see `docs/migration-readiness-report.md` warnings) — that's correct, not a validation failure, since `BookingItem.vendorId` is nullable by design |
| Rollback procedure | `TRUNCATE bookings CASCADE;` |
| Owner | _(assign)_ |

## Batch 7 — Invoices

| | |
|---|---|
| Source count | 1 invoice, 2 invoice items |
| Expected destination count | `invoices`: 1 · `invoice_items`: 2 |
| Validation query | `SELECT COUNT(*) FROM invoice_items ii LEFT JOIN invoices i ON ii."invoiceId" = i.id WHERE i.id IS NULL;` → 0. `SELECT "invoiceNumber" FROM invoices GROUP BY "invoiceNumber" HAVING COUNT(*) > 1;` → 0 rows |
| Rollback procedure | `TRUNCATE invoices CASCADE;` |
| Owner | _(assign)_ |

---

## Special case — OTP (not migrated)

`otps` currently has **0 live documents** (TTL-expired, as expected — every OTP
auto-deletes 5 minutes after creation). There is nothing to migrate for this
collection; the Postgres `otps` table starts empty and gets populated fresh once
`/api/otp/send` is repointed at Postgres during Milestone 4 (Authentication
Transition), not during Milestone 3.

## Special case — Users (net-new, not migrated from Mongo)

No Mongo collection maps to Postgres `users` — it's seeded directly from the two
current admin env-var accounts (`ADMIN_USERNAME`/`SUPER_ADMIN_USERNAME`), each given a
real bcrypt hash of their current password. This happens once, is not part of the
7 batches above, and should run before Batch 1 so `SUPER_ADMIN` login is available
for validating the rest of the migration as it proceeds.

---

## Full run acceptance

After all 7 batches pass individually, re-run `scripts/validate-post-migration.mjs`
(cross-database count + checksum comparison) as the final gate before considering
Milestone 3 complete. See `docs/rollback-checklist.md` for what happens if any batch
or the final validator fails.
