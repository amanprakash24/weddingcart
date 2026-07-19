# Wedding OS — Functional Design

Part 3 of the product sequence (Vision & PRD → Architecture & Database → **Functional
Design** → implementation). This is where every Wedding OS feature gets specified
before it's coded — the goal is that by the time the Postgres migration
(`docs/postgres-migration-plan.md` and friends) is done, there's a complete,
version-controlled blueprint for what gets built next, not a blank slate.

None of this depends on Milestone 3 finishing. It also isn't blocked on it.

## Documents

- **`01-command-center.md`** — Founder, Sales, Operations, and Vendor dashboards.
- **`02-crm.md`** — lead lifecycle, follow-up engine, sales pipeline.
- **`03-wedding-workspace.md`** — per-wedding view: timeline, events, vendors, budget, documents, tasks, communication, health score.
- **`04-vendor-os.md`** — profile self-service, availability/calendar, booking confirmation, packages, earnings, reviews, Vendor Score.
- **`05-customer-portal.md`** — written last on purpose, after AI. Couple-facing view of the Wedding Workspace data: overview, timeline, vendor directory, payments (Razorpay), budget (margin-filtered), documents, communication.
- **`06-finance.md`** — payments (Razorpay), vendor payouts, commission, GST data requirements, profit reporting.
- **`07-ai-assistant.md`** — AI mapped across every role (Founder/Sales/Operations/Vendor/Customer), 3-level framework (Assistant/Copilot/Autonomous — v1 ships Assistant+Copilot only), closes the AI-upgrade loop left open by 02/03/04.

## Phase B: domain model → schema

4-step process, chosen deliberately over jumping straight to Prisma: (1) resolve
open product/UX questions the domain model surfaces, (2) domain model in business
language, (3) physical Prisma schema, (4) schema review against the Entity Review
Framework — before any implementation.

- **`domain-model.md`** — Steps 1/2: business entities, relationships, the Wedding
  Aggregate (validated against every Wedding Workspace screen), bounded contexts,
  and the Step 4 review framework (5 questions every entity should answer: owner,
  independence, soft-delete, audit trail, AI read/write). Resolved along the way:
  `Booking` also converts into `Wedding` (via `CONFIRMED`), and the wedding date is
  collected at checkout, not at confirmation — `Booking` gains `weddingDate`
  (required), `weddingType`/`guestCount` (optional).
- **`schema-draft-1-notes.md`** — Step 3: the physical Prisma schema itself lives
  in `prisma/schema.prisma` (branch `feat/wedding-os-schema`), organized into the
  same bounded-context sections as `domain-model.md`. This doc explains what's
  genuinely new vs. Phase A's additive-only changes, the decisions made while
  writing it (`Role.OPERATIONS` added, "store events not state" implemented via
  `ActivityLog`, `VendorPaymentDetails` isolated for sensitivity), and a self-check
  against the primary conversion workflow — one gap flagged (automatic `Invoice`
  generation on conversion is a business-logic question, not modeled as a schema
  trigger). `npx prisma format`/`generate` both pass clean.
- **`step4-workflow-review.md`** — Step 4: all 6 named workflows traced against
  the actual schema. 1 real schema gap found (`BookingItem.vendorId` nullable vs.
  `VendorBooking.vendorId` required — resolved as a conversion-logic decision, not
  a schema change), 1 small fix applied directly (`Wedding.completedAt`), and 1
  open product question resolved into a real identity redesign the same day:
  `User.role` replaced by `UserRole` (multi-role per person) +
  `CustomerProfile`/`VendorProfile`/`EmployeeProfile` — see the file for the full
  ripple into already-shipped Milestone 1 auth code.
- **`track-b-conversion-pipeline.md`** — implementation *prep* (not a production
  feature — migration is still paused on staging): repositories + a transactional,
  idempotent service for exactly the prioritized `Booking(CONFIRMED) → Wedding →
  WeddingEvent → VendorBooking → Tasks → ActivityLog` pipeline. Not wired to any
  live route. Invoice/Payment creation deliberately excluded from this pass.

## Status: first-pass specification complete

All 7 modules have a first-pass functional design as of this doc. Each doc's "data
model gaps" section is the collected input for the Phase B schema design (the
`Wedding`/`WeddingEvent`/`VendorBooking`/`Payment`/`Task`/`ActivityLog`/`Document`
entities named throughout this set, on top of the Phase A schema already migrated
in `docs/postgres-migration-plan.md`). Phase B schema design is the next real
decision point — not implementation of any single module yet.

## Relationship to the Postgres migration

These specs will surface data-model requirements (new entities, new fields) that
don't exist in `prisma/schema.prisma` yet — that schema was deliberately scoped to a
1:1 port of the current Mongo collections (Phase A), with the `Wedding` entity and
everything downstream of it explicitly deferred to "Phase B." Each doc in this set
should end with a **"Data model gaps"** section listing exactly what Phase B needs to
add, so the eventual schema migration is driven by real functional requirements
instead of guessing ahead of time.
