# Phase A: MongoDB → PostgreSQL/Prisma/Auth.js — Design

Goal (per user direction, 2026-07-18): **no business logic changes**. The app should
behave exactly as it does today once this phase ships. The `Wedding`/CRM entity model
is explicitly **out of scope** here — that's Phase B, built on top of this stable
foundation.

Schema file: `prisma/schema.prisma`. All five open decisions below were resolved by
the product owner on 2026-07-19 and are reflected in the schema and this plan.
**Implementation (Phase 3) has not started** — this document is the approved
blueprint only.

## 1. ID strategy

Every table gets a UUID primary key (`id String @id @default(uuid())`), replacing
Mongo `ObjectId`. Two models — `Vendor` and `Category` — currently use a
human-readable string as their real Mongo `id` field (e.g. `"venue"`,
`"swayamvar-hall-patna"`), referenced directly in public URLs
(`/vendors/[id]`, `/categories/[id]`) and by other collections. That field becomes
`slug` (`@unique`), and all foreign keys point at the new UUID `id` instead. API
routes that look vendors/categories up by the old `id` param need to switch to
`WHERE slug = ...` instead of `WHERE id = ...` — a required code change, not just a
schema change.

Every lead-shaped table (`Lead`, `Enquiry`, `Consultation`, `Booking`, `Invoice`)
gets a **reserved, nullable, unenforced** `customerId` column now, per instruction to
keep future relationships from requiring another destructive migration. It has no FK
constraint yet because there's no `Customer`/`Wedding` table to point at until Phase B.

## 2. Normalization decisions

- **Category** becomes a real table with a real FK from `Vendor.categoryId` and
  `VendorApplication.categoryId` (today: plain unvalidated strings). See §5 for a
  live data-integrity issue this constraint surfaced.
- **Vendor.packages[]**, **Vendor.faqs[]**, **Booking.items[]**, **Invoice.items[]**
  become their own tables (`VendorPackage`, `VendorFaq`, `BookingItem`,
  `InvoiceItem`) with cascading FKs back to the parent — direct translation of
  Mongoose subdocument arrays.
- **Vendor.images**, **Vendor.features**, **Blog.tags**, etc. stay as native Postgres
  `String[]` columns — no relational need, avoids over-normalizing simple string lists.
- **`Consultation.cartItems`** stays a `Json` column — it was `Schema.Types.Mixed`
  with no enforced shape in Mongo; forcing it into a normalized table now would be a
  business-logic change, not a straight port.
- **`Consultation.weddingStyle` / `budgetRange` / `consultationDate`** — **dropped**
  from the schema entirely. See §5 for the audit that decided this.
- **OTP** stays a Postgres table (`Otp`) rather than moving to Redis, to avoid adding
  a new infra dependency outside the frozen stack. Postgres has no TTL index, so the
  app must filter `WHERE expiresAt > now()` on every read, and a small daily cleanup
  job (Vercel Cron hitting an API route, or a `pg_cron` job in Supabase) should delete
  expired rows so the table doesn't grow unbounded.

## 3. Auth.js (NextAuth) architecture

**Provider setup:** Credentials-only for Phase A — no OAuth providers, so no
`Account`/`Session`/`VerificationToken` adapter tables are included in the schema.
Session strategy is **JWT**, not database sessions — matches the current architecture
most closely (signed cookie checked in middleware/edge, no per-request DB lookup) and
keeps `middleware.ts` fast. If an OAuth provider (Google login for customers, say)
gets added later, the adapter tables can be added in a follow-up migration.

**Two login flows onto one `User` table, distinguished by `role`:**

1. **Credentials (email + password)** — for `SUPER_ADMIN` and `SALES`. Replaces the
   current two-hardcoded-env-var-pairs system in `lib/adminAuth.ts`. `User.passwordHash`
   is set (bcrypt), checked in the NextAuth `authorize()` callback.
2. **Phone + OTP** — for `VENDOR` and `CUSTOMER`. Reuses the existing `Otp` table and
   `/api/otp/send` + `/api/otp/verify` logic, wrapped in a custom NextAuth
   `CredentialsProvider` whose `authorize()` verifies the OTP server-side and returns
   (or creates) a `User` row with that phone number. `VENDOR` users additionally carry
   a `vendorId` FK linking their login to their `Vendor` profile row.

**Middleware:** replaces the custom Web-Crypto HMAC re-implementation in
`middleware.ts` (which had already drifted from `lib/adminAuth.ts` — different secret
fallback behavior) with NextAuth's own `auth()` middleware wrapper, checking
`session.user.role` against `['SUPER_ADMIN', 'SALES']` for `/admin/*`. This collapses
two independent HMAC implementations into one, closing that drift bug as a side effect.

### Decision 1 — `/api/seed` lockdown ✅

- Disabled entirely in production by default (`NODE_ENV === 'production'` short-circuits
  to 404/403 regardless of session).
- In non-production environments, requires **both** a valid `SUPER_ADMIN` session
  **and** an explicit `SEED_ENABLED=true` env var — a double safeguard so a stray
  staging deploy or misconfigured session can't trigger a wipe/reseed.
- Never publicly accessible under any environment. This closes the current gap where
  the "super admin only" restriction is UI-only, not server-enforced.

### Decision 2 — Vendor onboarding image upload ✅

Adopts the temporary-folder flow: applicant fills the form → uploads go to a
Cloudinary folder scoped per application session (e.g.
`shaadishopping/vendor-applications/tmp/{applicationSessionId}`, where
`applicationSessionId` is a short-lived, unauthenticated but unguessable token minted
client-side when the form loads, rate-limited server-side) → application is submitted
referencing those temp URLs → on admin approval, images are copied/moved (Cloudinary
supports server-side rename between folders without re-upload) into the permanent
`shaadishopping/vendors/{vendorId}` folder and the `Vendor` record is created pointing
at the new URLs.

Abandoned temp uploads (application never submitted, or submitted-but-never-approved
past a threshold) are cleaned up by a scheduled job — recommend 30 days, matching the
product owner's suggestion — that lists the `tmp/` folder via the Cloudinary Admin API
and deletes assets older than the threshold with no corresponding submitted
`VendorApplication`.

This replaces `requireAdmin()` on the temp-upload path specifically; the existing
admin-authenticated upload path (used by `AdminVendorDetailClient`, `AdminBlogEditorClient`,
etc.) is untouched.

### Decision 3 — Cutover strategy ✅

Parallel build with a controlled cutover (not continuous dual-write, not a cold
big-bang):

1. Build and fully test the Postgres/Prisma/Auth.js version against a copy of
   production data, in a staging environment.
2. Verify every item in the Migration Acceptance Checklist (§6) against staging.
3. Run the real migration script against a **fresh copy** of production data (not the
   live DB) to rehearse timing and catch failures with zero user impact.
4. Schedule a short maintenance window; run the final migration against live
   production data.
5. Switch traffic (env vars / deploy) to the Postgres-backed app.
6. Keep the MongoDB instance and the old code path (via a tagged git ref / previous
   deployment) available and untouched for a defined rollback window (recommend
   2 weeks minimum) before decommissioning Mongo.

### Decision 4 — Firebase Auth removal ✅ (done)

Confirmed zero live usage. Already removed from this branch as part of this design
pass, not deferred to implementation:
- Deleted `lib/firebase.ts`
- Removed `firebase` from `package.json` / `package-lock.json` (`npm install` run to
  sync the lockfile — 81 transitive packages dropped)
- Removed the six `NEXT_PUBLIC_FIREBASE_*` vars from `.env.example`

### Decision 5 — Consultation schema-drift audit ✅ (done)

Ran a read-only audit against the live MongoDB `consultations` collection
(2026-07-19, 16/16 documents):

- `weddingStyle`, `budgetRange`, `consultationDate`: **0/16 documents** have a
  non-empty value for any of the three. They are dead fields — written as
  undefined/empty by the API path in practice, never actually populated. **Dropped
  from `prisma/schema.prisma` entirely** rather than kept as permanently-empty
  columns (see §2).
- `cartItems`: consistently an empty array in the sample checked — consistent with
  `Json?` staying loosely typed rather than normalized.

The same audit pass also checked two things the migration will depend on:

- **Referential integrity for the new `Vendor.categoryId` FK**: 92 of 93 vendors had
  a `category` value matching a real `Category.id`. **One orphan found and fixed
  (2026-07-19):** vendor *"Shringaar Bridal Jewels"* referenced `category:
  "bridal-jewellery"`, which had no matching `Category` document (21 categories
  present, not the canonical 22). Confirmed `bridal-jewellery` is a real, permanent
  category — wired into the Navbar, planning wizard, city pages, and
  `generateStaticParams` for `/categories/[slug]` — not a vendor data error, so the
  fix was to create the missing `Category` document (using the exact definition from
  `data/seedData.ts`), not reassign the vendor.
- **Slug uniqueness**: no duplicate `Vendor.id` values found (93 vendors, 93 unique
  ids) — the new `slug @unique` constraint is safe to add as-is.

A dedicated, reusable validator (`scripts/validate-migration-readiness.mjs`) was then
built to cover the full checklist the product owner requested (missing categories,
duplicate slugs, missing required fields, invalid images, duplicate phone/email,
broken booking/enquiry/application references). Its first run additionally caught 3
test enquiry documents (the product owner's own test submissions — same phone/email,
junk vendor references) as blocking issues; these were deleted. Final run: **0
blocking issues, 2 non-blocking warnings** (legitimate historical bookings against a
vendor later converted to a static landing page). Full report:
`docs/migration-readiness-report.md`.

## 4. Migration mapping (Mongo → Postgres)

| Mongo collection | Postgres table | Notes |
|---|---|---|
| `vendors` | `vendors` | `id` (slug) → `slug`; new UUID `id`; `category` string → `categoryId` FK (fix 1 orphan first, see §3 Decision 5) |
| `categories` | `categories` | `id` (slug) → `slug`; new UUID `id` |
| `vendorapplications` | `vendor_applications` | `category` string → `categoryId` FK; `vendorId` string → real FK |
| `bookings` | `bookings` + `booking_items` | `items[]` subdocs → child rows |
| `enquirys` | `enquiries` | `vendorId` string → real FK (must resolve against migrated `vendors.id`) |
| `consultations` | `consultations` | drift fields dropped, see §3 Decision 5 |
| `invoices` | `invoices` + `invoice_items` | `items[]` subdocs → child rows |
| `leads` | `leads` | straight port |
| `blogs` | `blogs` | straight port |
| `otps` | `otps` | TTL index → `expiresAt` column + cleanup job |
| *(none — env vars)* | `users` | net-new: 1 row each for current `ADMIN_USERNAME`/`SUPER_ADMIN_USERNAME` accounts, seeded with a real bcrypt hash of their current passwords (rotate afterward) |

**Migration script approach:** a one-off Node script (`scripts/migrate-to-postgres.mjs`)
that connects to both Mongo (via existing Mongoose models) and Postgres (via
`@prisma/client`), reads each collection in `id`-ascending order, transforms, and
writes via `prisma.<model>.create()`, in dependency order (`categories` → `vendors` →
everything that FKs to vendors/categories). After each collection, verify row counts
match. Keep the Mongo connection string read-only during this window — no writes to
Mongo once the script starts, to avoid divergence. Run this script against the
rehearsal copy first (§3 Decision 3, step 3) before the real cutover.

## 5. Explicitly out of scope for Phase A

- `Wedding`, `WeddingService`, `VendorAvailability`, `PaymentSchedule`, `Task`,
  `Timeline` — Phase B.
- Sales/Customer role UI, vendor portal, customer portal — no pages exist yet;
  Phase A only establishes the `Role` enum and auth plumbing, not the portals
  themselves (that's the Sprint roadmap).
- Cloudinary — zero changes, confirmed no coupling beyond the `requireAdmin()` gate
  on the two upload routes, which gets swapped for the equivalent Auth.js check.

## 6. Migration Acceptance Checklist

To be run against staging before the rehearsal migration (§3 Decision 3, step 2), and
again against production immediately after the real cutover (step 5) before the
rollback window is allowed to lapse.

**Functional**
- [ ] Super Admin / Sales login works (Credentials)
- [ ] Vendor login works (Phone + OTP)
- [ ] `/admin/*` pages load and are correctly gated by role
- [ ] Vendor detail pages load with correct packages/faqs/images
- [ ] Images display correctly (Cloudinary URLs unaffected)
- [ ] Vendor search/filter (category, city, price, rating) returns correct results
- [ ] Booking creation (cart checkout) works end-to-end
- [ ] Vendor enquiry + OTP verification flow works
- [ ] Consultation submission works
- [ ] Admin dashboard stats (`/api/stats`) match pre-migration values
- [ ] Blog CMS: create/edit/publish/list works
- [ ] Vendor application submission + image upload (temp-folder flow) works
- [ ] Vendor application approval creates a `Vendor` + moves temp images to permanent folder
- [ ] `/api/seed` confirmed inaccessible in production

Run `scripts/validate-migration-readiness.mjs` as the automated pass for the "Data"
section below before every rehearsal/production run — see
`docs/migration-readiness-report.md` for the latest clean result.

**Data**
- [ ] Vendor count matches Mongo source count (93 as of 2026-07-19)
- [x] Category count matches (22, after the `bridal-jewellery` fix on 2026-07-19)
- [ ] Blog count matches (47 as of 2026-07-19)
- [ ] Booking / Enquiry / Consultation / Invoice / Lead counts match
- [x] No orphaned FKs (`vendor.categoryId`, `enquiry.vendorId`, `vendorApplication.vendorId`) — validator run 2026-07-19, 0 blocking issues
- [ ] Slugs unchanged (`Vendor.slug`, `Category.slug`, `Blog.slug`)
- [ ] Image URLs valid (spot-check a sample of Cloudinary URLs post-migration)
- [x] The `bridal-jewellery` orphan resolved (2026-07-19) — see §3 Decision 5

**Performance**
- [ ] Homepage loads within current baseline
- [ ] Vendor search responds within current baseline
- [ ] Indexes present: `vendors(categoryId, city, rating)`, `blogs(status, publishedAt)`,
      `blogs(category, status)`, `otps(phone)`

## Status

All five decisions resolved 2026-07-19. Firebase removal, the live-data audit, the
`bridal-jewellery` category fix, and the 3-test-enquiry cleanup are all done. The
pre-migration validator (`scripts/validate-migration-readiness.mjs`) reports 0
blocking issues as of 2026-07-19 — see `docs/migration-readiness-report.md`. This
design work is committed on `feat/postgres-prisma-migration`, and `main` (the last
pre-migration commit) is tagged `mongo-final` as a rollback/comparison point. Ready
to begin Phase 3 implementation.
