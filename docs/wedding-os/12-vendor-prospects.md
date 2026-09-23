# Vendor Prospects — sales outreach tracker (23 Sep 2026)

## Why this exists

Sales was given a list of 576 Patna venues to onboard onto ShaadiShopping, sourced from a competitor
site (weddingz.in) via a local scraper (`~/weddingz-scraper/`). The list includes each venue's own
factual/contact data (name, address, phone, email, contact person, capacity, price/plate, venue type) —
but also the competitor's own written "About Venue" copy and photo URLs hosted on their CDN.

**Decision: outreach lead list only.** The competitor's descriptions and photos are never copied into
ShaadiShopping — only the venue's own contact/factual info. A venue becomes a real, listed vendor only
by actually going through `/vendor-onboarding` (`VendorApplication` → `services/vendorApplication.service.ts`)
with its own photos and its own description, the same as any other vendor. `VendorProspect` exists to
track outreach progress on the lead list itself — it is explicitly **not** a vendor, and nothing reads
it for search, matching, or public display.

## Model

`VendorProspect` (`prisma/schema.prisma`) — one row per lead: name, area, full address, city, phone,
email, contact person, seating/max capacity, price/plate (veg/non-veg), venue type, `source`/`sourceUrl`
(provenance, always recorded), and a `VendorProspectStatus`:

```
NEW → CONTACTED → INTERESTED → ONBOARDING → ONBOARDED
                              ↘ DECLINED
                              ↘ ALREADY_LISTED
```

Any status is reachable from any other (no guarded transition matrix) — this is a lightweight sales
tracker, not a workflow with financial/booking consequences, same posture as `BookingStatus`/
`EnquiryStatus` elsewhere in this schema. `notes` is free text; `lastContactedAt` is stamped automatically
whenever the status moves away from `NEW`.

Deliberately no FK to `Vendor` or `VendorApplication` for V1 — once someone actually onboards, marking
the prospect `ONBOARDED` is a manual status change, not an automated link. A real link (and the
onboarding form pre-filling from the prospect's data) is a reasonable fast-follow, not built here.

## Import (one-time, not a UI feature)

`vendorProspectService.importRows()` is the reusable import entry point (unit-tested); loading it from a
scraped file is a throwaway script, not a shipped feature, since the source file lives on a local machine
and can't be read from a deployed environment anyway. Two safety properties:

1. Skips any row whose exact `(name, phone)` pair already exists as a prospect — re-running an import on
   the same source file is a no-op for rows already loaded.
2. Any row whose phone exactly matches an existing `Vendor.ownerPhone` imports as `ALREADY_LISTED`, not
   `NEW` — confirmed against real data before shipping: of ShaadiShopping's 39 existing Patna-category
   vendor rows, only 3 have a phone number on file at all, so this dedup is necessarily limited to those
   exact matches. Fuzzy name-matching was tried and rejected — Patna banquet-hall names share generic
   words (Royal, Grand, Green, Heritage, Vivah, Celebration, Darbar) across dozens of unrelated
   businesses, producing far more false positives than true matches.

The 2026-09-02 weddingz.in scrape (576 rows) was imported this way: 576 created, 1 auto-detected as
`ALREADY_LISTED` (exact name+phone match — Touch of Cozy), 575 `NEW`. 72 rows share a phone number with
another row in the same import (one owner/group running several halls) — visible in the admin UI as
duplicate phone numbers across rows, not deduplicated away, since they are genuinely separate venues.

## Admin UI

`/admin/vendor-prospects` (nav: More → Vendor prospects) — `components/AdminVendorProspectsClient.tsx`,
matching `AdminVendorListClient.tsx`'s existing styling/data-fetch conventions rather than the newer
Vendor OS design-token system, since this lives in the admin surface. Stats bar (count per status),
search/city/status filters, paginated table (50/page) with an inline status dropdown (PATCH on change)
and a notes field (PATCH on blur).

`GET/PATCH /api/vendor-prospects` — admin-only (`requireAdmin()`), same pattern as
`/api/vendor-applications`.

## Verification

`tsc`/`eslint` clean, `bun test` — 16 new tests (service: status updates incl. `lastContactedAt`
stamping, import dedup/already-listed detection; both routes: auth, validation, pass-through), full suite
998/998 pass. `npm run build` clean, `/admin/vendor-prospects` + both API routes present in build output.
Migration applied to staging (`xlrswgsadncosezfdgbm`) via `prisma migrate deploy`. Browser-verified
end-to-end as a real admin (disposable login, deleted after): real 576-row data rendered correctly,
search/filter worked, a real status change and note both persisted and updated the live stats bar,
`ALREADY_LISTED` auto-detection confirmed on the real Touch of Cozy row. The one row touched during
verification was reverted to a clean `NEW` state afterward — this data is real and will actually be used
for outreach, not disposable test data.

## A `prisma.config.ts` fix that had to be re-applied here

`prisma migrate dev`/`migrate status` hang indefinitely against `DATABASE_URL` (PgBouncer transaction-mode
pooler — no session-level advisory lock support the migration engine needs); the fix (point the CLI's
`datasource.url` at `DIRECT_URL` instead) was already found and fixed once this session, but only on the
still-unmerged Vendor OS branch — a fresh branch off `main` didn't have it and hit the same hang again.
Re-applied here, on `main`'s lineage, so the next branch off `main` doesn't hit it a third time. This
strongly suggests the fix (and the already-applied-but-unmerged `VendorCapability` migration this branch
also had to pick up to reconcile drift) should land on `main` on its own, independent of the rest of the
unmerged Vendor OS work.
