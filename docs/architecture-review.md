# Architecture Review — Shaadi Shopping OS

Prepared 2026-07-19 ahead of the team review (~80 min agenda). Sections 1–2 and the
Milestone plan in §6 reflect work already committed on `feat/postgres-prisma-migration`
(see `docs/postgres-migration-plan.md`, `prisma/schema.prisma`). Sections 3–5 are
**proposals** for the team to ratify in the live meeting, not settled decisions —
they're grounded in the codebase's actual current conventions (checked directly,
not assumed) so the discussion starts from reality rather than a blank page.

---

## 1. Product Vision (10 min)

**Shaadi Shopping is not just a vendor marketplace — it's Shaadi Shopping OS.** The
public website is one surface among several the platform will eventually run:

| Surface | Users | Status |
|---|---|---|
| Public website | Customers browsing/booking vendors | Live |
| `/admin` | Super Admin, Sales | Live (Mongo/HMAC today, migrating) |
| `/vendor` | Vendors (profile, pricing, availability, bookings, earnings) | Not built |
| `/customer` | Customers (progress tracking, chat, payments) | Not built |

All four stay under the single **ShaadiShopping** brand and domain, path-based
(`/admin`, `/vendor`, `/customer`, `/api`) rather than subdomains — decided
2026-07-18 for SEO consolidation, lower cost, and simpler auth (see
`docs/postgres-migration-plan.md`). The internal-codename idea ("VivahOS") was
considered and explicitly rejected — everything stays ShaadiShopping.

**Signature differentiators**, not yet built (Phase B, after the Postgres migration):
Wedding Command Center (single-screen view of a wedding: customer, services,
payments, timeline, communication), Vendor Score (composite performance ranking),
and an AI Assistant surfacing proactive nudges. The core architectural principle
underpinning all of it: **model around the Wedding, not the Lead** — `Lead → Wedding
→ Services → Vendor Bookings → Payments/Tasks`.

**What everyone in the room should walk away agreeing on:** the current migration
(Mongo → Postgres/Prisma/Auth.js) is deliberately scoped to *not* include the Wedding
entity yet — it's laying a relational foundation stable enough to carry that weight
later, not shipping the CRM itself.

---

## 2. Database Review (20 min)

Full schema: `prisma/schema.prisma` (16 models). Full reasoning: `docs/postgres-migration-plan.md`.

**Every table, grouped by domain:**
- **Auth:** `User` (role-based: SUPER_ADMIN/SALES/VENDOR/CUSTOMER), `Otp` (ephemeral phone verification)
- **Catalog:** `Category`, `Vendor`, `VendorPackage`, `VendorFaq`, `VendorApplication`
- **Leads/transactions:** `Lead`, `Enquiry`, `Consultation`, `Booking`, `BookingItem`, `Invoice`, `InvoiceItem`
- **Content:** `Blog`

**Every relationship:**
- `Vendor.categoryId → Category.id` (real FK — was an unvalidated string in Mongo)
- `VendorApplication.categoryId → Category.id`, `VendorApplication.vendorId → Vendor.id` (nullable, set on approval)
- `User.vendorId → Vendor.id` (nullable, links a VENDOR-role login to their profile)
- `VendorPackage.vendorId`, `VendorFaq.vendorId` → `Vendor.id` (cascade)
- `BookingItem.bookingId → Booking.id` (cascade); `BookingItem.vendorId → Vendor.id` (**nullable** — tolerates historical bookings against vendors later removed, e.g. "Touch Of Cozy")
- `InvoiceItem.invoiceId → Invoice.id` (cascade)
- `Enquiry.vendorId → Vendor.id` (required)
- `Lead`, `Enquiry`, `Consultation`, `Booking`, `Invoice` each carry a **reserved, nullable, unenforced** `customerId` — no FK target exists yet, deliberately left for Phase B's `Customer`/`Wedding` entity so it doesn't require a second destructive migration

**Index strategy:**
- `Vendor(categoryId, city, rating)` — compound, matches the hot vendor-search query path
- `Blog(status, publishedAt)`, `Blog(category, status)` — matches current blog list queries
- `Otp(phone)`
- Gap to discuss: no full-text/trigram index yet (current Mongo search is regex-based, not `$text`); not blocking at 93 vendors, worth revisiting before the catalog grows an order of magnitude

**UUID usage:** every table has a UUID primary key. `Vendor` and `Category` — the two
models Mongo addressed by a human-readable string in public URLs — keep that string
as a separate `slug @unique` field; all foreign keys point at the UUID, not the slug.

**Cascade rules:** child/subdocument tables (`VendorPackage`, `VendorFaq`,
`BookingItem`, `InvoiceItem`) cascade-delete with their parent. Everything else uses
Prisma's default (restrict) — deleting a `Category` with vendors attached, or a
`Vendor` with enquiries attached, is blocked rather than silently cascading, since
that's user/business data, not a subdocument.

**Constraints:** unique on `Vendor.slug`, `Category.slug`, `Blog.slug`,
`Invoice.invoiceNumber`, `User.email`, `User.phone`, `User.vendorId`,
`VendorApplication.vendorId`.

### "Can this still support 100,000 weddings?"

Honest answer, not a reflexive yes: **the relational design scales fine — Postgres
handles tables with 100k+ rows and these index patterns trivially — but "100,000
weddings" isn't literally representable yet**, because the `Wedding` entity doesn't
exist in this schema by design (Phase B). What this schema supports at 100k+ scale
today is the marketplace primitives: vendors, bookings, enquiries, leads, invoices.
The honest gate to pass isn't "does this table design scale" (yes) — it's "does
Phase B's Wedding schema, built on top of this foundation, hold up at that volume,"
which is a question for the *next* review, once Phase B is designed. Recommend the
room explicitly acknowledge this distinction rather than let "yes" stand in for both
questions.

---

## 3. API Review (15 min) — proposed standards

**Current state, checked directly against the code (not assumed):** the existing API
already has two incompatible conventions in production. `GET /api/vendors` returns
`{ success, data, total, page, limit }`; `GET /api/blogs` returns
`{ blogs, total, page, pages }` — different envelope key, different field name for
total pages, no `success` field. Errors are inconsistently `{ error: 'message' }`
strings with no machine-readable code. This is normal organic drift, not a mistake to
assign blame for — it's exactly what this agenda item exists to fix going forward.

**Proposed standard (for team sign-off):**

| Concern | Standard |
|---|---|
| Naming | Plural, kebab-case resource paths (`/api/vendor-applications`); nested only for true ownership (`/api/vendors/[id]/packages`) |
| Success envelope | `{ data: T }` single resource; `{ data: T[], pagination: { page, limit, total, totalPages } }` list |
| Error envelope | `{ error: { message: string, code: string } }` with correct HTTP status (400/401/403/404/409/500) — `code` is a stable machine-readable string (`VALIDATION_ERROR`, `NOT_FOUND`, etc.), not just the HTTP status restated |
| Validation | Introduce **Zod** — schema-validate `req.json()` / `searchParams` at the top of each handler before touching Prisma. New dependency, not currently in the stack; justified by removing the current pattern of untyped `body.title` access with no runtime check |
| Pagination | `?page=&limit=` (1-indexed), default `limit` documented per-resource in the route file |
| Filtering | Flat query params matching the field name (`?category=&city=&minPrice=`) — keeps the pattern `/api/vendors` already uses, extended consistently to every list endpoint |
| Sorting | `?sort=<field>&order=asc|desc` — replaces today's baked-in enum strings (`sort=price-asc`) with a composable pair |
| Auth middleware | The `requireRole(Role[])` helper in `lib/auth/session.ts` (wraps NextAuth v4's `getServerSession()` — see the v4-not-v5 correction in the migration plan §3), replacing `requireAdmin()`/`isAdmin()` (two slightly different existing implementations) — applied to every route uniformly, closing the `/api/seed` gap already decided in the migration plan |

**Important scoping note:** this is a breaking response-shape change. It does **not**
apply retroactively to every route in Milestone 1 — it lands module-by-module during
Milestone 5 (Categories → Blogs → Vendors → Vendor Packages/FAQs → Leads → Bookings →
Invoices), each PR updating both the route and its frontend callers together, per the
"not everything in one giant PR" instruction already agreed for that milestone.

---

## 4. Folder Structure (10 min) — proposed, freeze before Milestone 1 code

Starting point was the team's suggested `services/`, `repositories/`, `modules/`,
`hooks/` split. Recommendation: adopt the two that have an immediate, concrete job in
Milestone 2 (repository layer), and **defer** the two that don't have a real second
consumer yet — adding empty scaffold folders now just invites inconsistent early
placement decisions.

```
app/            # routes only — pages + route handlers (existing, unchanged)
components/     # React components, *Client.tsx convention for client components (existing, unchanged)
lib/            # cross-cutting utilities: prisma.ts (new), auth.ts (new), whatsapp.ts, shaadiPhone.ts
                 # (mongodb.ts + models/ retired module-by-module during Milestone 5, not deleted in Milestone 1)
repositories/   # NEW — one file per Prisma model; every raw `prisma.<model>.*` call lives ONLY here
services/       # NEW — business logic composing repositories (e.g. approveVendorApplication()
                 # spans VendorApplication + Vendor + Cloudinary move, doesn't belong in a route handler)
types/          # shared TS types (existing, unchanged)
prisma/         # schema.prisma + migrations/ (existing, created this session)
scripts/        # one-off ops/validation scripts (existing, unchanged)
```

**Recommend deferring** `modules/` and `hooks/` — introduce each only when a second
real consumer needs it (e.g. `hooks/` once a second component needs the same custom
hook a first one already has). Flag this as a discussion point, not a unilateral cut
— the team may have context for wanting them pre-staged.

---

## 5. Coding Standards (10 min) — proposed, grounded in current repo state

**ESLint:** already configured (`eslint-config-next` core-web-vitals + typescript,
`eslint.config.mjs`). No changes needed — recommend keep as-is.

**Prettier:** **not currently configured** — no `.prettierrc`, no format-on-save
enforcement, formatting is whatever each editor happened to produce. Proposed config
(matches the de facto style already in most files — semicolons, single quotes):
```json
{ "semi": true, "singleQuote": true, "trailingComma": "es5", "printWidth": 100 }
```

**Naming conventions (already organically consistent, worth formalizing):**
PascalCase components/models, camelCase functions/variables, `*Client.tsx` suffix for
client components, kebab-case route segments (Next.js convention).

**Commit messages:** git history already follows `type: short description` (`feat:`,
`fix:`) — propose formalizing as Conventional Commits (`feat|fix|chore|docs|refactor|test`).

**Branch naming:** git history already follows `type/kebab-case-description`
(`feat/venue-virtual-tour`, `fix/unfeature-non-patna-demo-vendors`) — propose
formalizing as-is, no change to current practice.

**Pull request template:** **none exists today.** Proposed
`.github/PULL_REQUEST_TEMPLATE.md` with Summary / Changes / Test plan sections.

---

## 6. Milestone Planning (15 min)

6 milestones, module-by-module rather than one giant PR. Revised 2026-07-19 to give
OTP/vendor/customer authentication its own milestone rather than folding it into
Infrastructure or the module cutover — the principle: **don't migrate the login flow
until the new database layer is proven stable.**

| # | Milestone | Owner | Status |
|---|---|---|---|
| 1 | Infrastructure — Postgres, Prisma, Auth.js (Credentials provider only), connection layer, env vars | _(assign: Developer A/B)_ | ✅ Done (2026-07-19) |
| 2 | Data Access Layer — `repositories/*.repository.ts` per Prisma model (vendor, booking, lead, blog, category, …), `services/*` for business logic that spans repositories. App code calls repositories, never `prisma.*` directly | _(assign)_ | ✅ Done (2026-07-19), 3 lowest-risk models (Category, Blog, Vendor) |
| 3 | Data migration — dry run, validation, performance testing, rollback testing | _(assign)_ | ✅ Done (2026-07-20) — executed live against Supabase staging, 0 mismatches, see `docs/migration-log.md` |
| 4 | **Authentication Transition** — `/api/otp/send` + `/api/otp/verify` repointed at Postgres, OTP persistence/cache strategy, vendor login, customer login, session creation, rate limiting, audit logging. Sits after Milestone 3 (DB proven stable) and before any module cutover that depends on vendor/customer auth | _(assign)_ | ✅ Done (2026-07-21) — admin/vendor/customer login all live on NextAuth, verified end-to-end against staging, see `docs/security-checklist.md` |
| 5 | Switch modules one at a time: Categories → Blogs → Vendors → Vendor Packages/FAQs → Leads → Bookings → Invoices | _(assign per module)_ | Not started — superseded in practice by the CRM vertical-slice direction (see `docs/wedding-os/`); revisit whether this milestone still runs as originally scoped |
| 6 | Production cutover — maintenance window, migration, verification, monitoring, rollback-if-needed | _(assign)_ | Not started |

**Definition of Done, applied to every milestone/module above** (not just "code
compiles"): unit tests pass · integration tests pass · TypeScript clean · Prisma
migration verified · acceptance checklist complete (`docs/postgres-migration-plan.md`
§6) · documentation updated · rollback tested.

**Ownership placeholders left blank deliberately** — fill in during the live meeting;
not a call for this document to make unilaterally.

**Post-migration principle (once all 6 milestones ship):** stop adding new features
directly to the old admin. Every new capability from that point forward — CRM,
Wedding Workspace, Vendor Calendar, Finance — gets built as a modular part of Shaadi
Shopping OS on the new foundation, not as a one-off addition to what's being retired.

---

## Status

Sections 1–2: reflect committed, already-reviewed work. Sections 3–5: proposals
awaiting team ratification. Section 6: milestone structure agreed (6 milestones as of
2026-07-19, Authentication Transition added as its own step) — **Milestones 1–4 are
now done** (Infrastructure, Data Access Layer, Data Migration, Authentication
Transition — the last as of 2026-07-21, tagged `milestone-4-auth-transition`).
Milestones 5–6 (module cutover, production cutover) are not started, and per the
2026-07-21 product-direction decision, Milestone 5 in practice is being reconsidered
as the first Wedding OS **vertical slice** (CRM) rather than the originally-scoped
module-by-module Mongo→Postgres switch — see `docs/wedding-os/` for the current
framing. `main` will not be merged into until
the full sequence in `docs/postgres-migration-plan.md` (code review → staging →
rehearsal → acceptance checklist → cutover) is satisfied — no change to that decision.
