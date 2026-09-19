# Vivah OS — Tech Completion Matrix (Phase 1 audit)

Living completion matrix required by the *Tech Completion & Product Experience Handoff* (20 Sep 2026, §5).
Update this file whenever a row changes; every status change needs evidence (file, query, or test command).

| | |
|---|---|
| **Audited** | 20 September 2026 |
| **Code baseline** | `main` @ `ab416c3` (after PR #101, Consultation → Enquiry bridge). PR #102 (vendor-onboarding phone + public upload) is open and **not** included. |
| **Databases read** | Supabase **staging** (`shaadishopping-staging`) for schema/integrity checks; Supabase **production** (`shaadishopping-prod`) for migration state only. All read-only. |
| **Method** | Read the code (routes, services, repositories, schema, tests); scanned every API route for guards; ran read-only SQL on staging; verified production login and routes over HTTPS. |
| **Not verified** | Anything needing a browser click-through (UI clarity, mobile), Vercel environment variables (no access from the audit session), real WhatsApp/Razorpay/Cloudinary behaviour. Marked **UNVERIFIED** below — do not read them as "works". |

**Status vocabulary:** `DONE` · `PARTIAL` · `MISSING` · `BUG` · `BLOCKED` · `UNVERIFIED`
**Priority:** as defined in Appendix A of the handoff (P0 blocks a complete wedding / data / security / payment / deployment).

---

## 1. Verdict

Can one 500-guest wedding be run **enquiry → completion** through the app today without database repair? **No.**
The chain breaks at these handoffs (each is a P0 under the handoff's own definition):

| # | P0 blocker | Where it breaks |
|---|---|---|
| P0-1 | **No quotation flow.** `Quotation` is a bare model — no service, API or UI writes or reads it. | Enquiry → Quotation → Approval → Booking |
| P0-2 | **Wedding events cannot be added or edited after conversion.** Conversion creates one event; nothing creates Haldi / Mehendi / Sangeet. | Wedding → Events |
| P0-3 | **No vendor/venue availability writes and no double-booking protection anywhere** (Booking, VendorBooking). `vendor_availability` has 0 rows and no writer. | Booking, Vendor Booking |
| P0-4 | **Wedding can be marked COMPLETED with unpaid balance, open tasks, unconfirmed vendors.** No reconciliation guard. | Wedding → Completion |
| P0-5 | **No way to record a non-Razorpay payment** (cash / UPI / bank transfer). Payments exist only via a Razorpay payment-link webhook, and only for an invoice that already belongs to a Wedding. | Wedding → Invoice → Payment |
| P0-6 | **No Golden test, no resettable seed, no DB-backed integration harness.** All 31 test files are unit tests with mocks; concurrency guards are untested against a real DB. | Testing (§12–13) |
| P0-7 | **Vendor/customer OTP delivery unverified.** OTP is sent as free-form WhatsApp text; Meta generally only allows free-form messages inside a 24-hour window, so a first-time venue owner may never receive a code. Not tested against the real account. | Authentication |

What already works and is worth protecting: Booking → Wedding hand-off with duplicate-wedding guard (locked, unique source columns, tested), webhook signature + idempotency, per-wedding data isolation on the client/vendor portals, activity logging inside the conversion/payment/approval paths, Command Center aggregates, reproducible migrations (a fresh empty production database took all 20 migrations cleanly on 19–20 Sep).

### Decisions from the founding team (#4 open; #1, #2, #3 resolved)
1. ~~Golden-path shape~~ — **RESOLVED 20 Sep 2026: keep `Lead`, `Consultation` and `Enquiry` as parallel capture tables.** They stay independent, unified only in the CRM inbox (`services/leadInbox.service.ts`), with no Lead → Consultation link. The handoff's "Lead → Consultation" step is therefore not a conversion in this product. Consequence for testing (proposed, follows from the decision): the Golden test starts at a **Consultation** (the `/plan` path) → "Start Enquiry" per vendor; Lead capture and the Lead → Wedding conversion are covered by a separate CRM test.
2. ~~Consultation → Enquiry duplicates~~ — **RESOLVED 20 Sep 2026: keep multiple Enquiries per Consultation.** One Consultation (a couple's multi-service brief) legitimately produces one Enquiry per vendor, so PR #101's design stands and the handoff's "prevent duplicate conversion" rule is **not** applied to this handoff. It still applies to Booking → Wedding, which stays locked and unique.
3. ~~Payment sequencing~~ — **RESOLVED 20 Sep 2026: payment after the wedding; keep today's order.** Booking → **Wedding → Invoice → Payment**. An invoice belongs to a Wedding, so no payment exists before the Wedding does; the handoff's "Payment → Wedding" order is **not** adopted. Consequences: (a) the Golden test moves "Record/verify payment" to *after* "Create Wedding"; (b) a Booking can be CONFIRMED (and convert to a Wedding) before any money moves, so the quotation's advance is an *expected* amount, not a collected one — the advance is collected through the Wedding's invoice; (c) **still open, proposed not decided:** whether an approved quotation should auto-create that advance Invoice on conversion (flagged earlier as a business-logic question in `docs/wedding-os/schema-draft-1-notes.md`) or the coordinator creates it by hand as today.
4. **Role separation.** `SUPER_ADMIN`, `SALES` and `OPERATIONS` are one access class (`ADMIN_ROLES`). Founder-only data/actions (handoff §7) are not enforced. Needed for V1?

---

## 2. Golden-path handoffs (§4)

| Handoff | Status | Evidence in repo | Missing / bug | Pri | Required action | Test |
|---|---|---|---|---|---|---|
| Lead → Consultation | **DONE** (by decision) | `Lead`, `Consultation`, `Enquiry` are deliberately independent capture tables, unified only in the CRM inbox (`services/leadInbox.service.ts`) and each convertible to a Wedding through the shared pipeline (`weddingConversion.service.ts`). Decision 20 Sep 2026: keep them parallel. | No conversion between them by design. Still open, independent of the decision: no duplicate detection on phone/email in `lead.service` / `enquiry.service` / `consultation.service`, so the same person can appear as a Lead, a Consultation and an Enquiry with nothing linking them. | P1 | Phone-based "possible duplicate" warning in the CRM inbox (link, don't merge). Record the rule in `docs/wedding-os/domain-model.md`. | CRM test: same phone across Lead + Consultation + Enquiry → surfaced as one person in the inbox |
| Consultation → Enquiry | **DONE** (by decision) | PR #101: `Enquiry.consultationId` (nullable, indexed, deliberately **not** unique); admin "Start Enquiry" prefills date, guests, budget, requirements and client from the consultation (`components/AdminClient.tsx`); `enquiry.service.create` connects the relation. Delete guards: `services/enquiry.service.ts`, `consultation.service.ts` (PR #95). Decision 20 Sep 2026: several Enquiries per Consultation are intended. | Vendor is not carried (a Consultation has none) — the admin picks one per Enquiry. Optional, not required: warn when the same consultation already has an Enquiry for the same vendor. | — | None required. Record the rule in `docs/wedding-os/domain-model.md`. | `services/enquiry.service.create.test.ts` ("one Consultation can produce multiple Enquiries — consultationId is not unique") already covers it |
| Enquiry → Quotation | **MISSING** | `prisma/schema.prisma` `Quotation` model only (FKs to lead/enquiry/consultation, `amount`, `status`, `pdfUrl`). Grep for `quotation.create/update`, `quotationService`, `quotationRepository`: **no hits**. Table has 0 rows in staging and prod. | No line items, quantity/price, discount/tax, server-side totals, advance/balance, approval/rejection, revision. Model is single `amount` only. | **P0** | Design `QuotationItem` + totals in a service; API + admin UI; customer approve/reject (reuse `ApprovalRequest`). | Quotation unit tests (totals, tax, rounding) + route tests + Golden step 4–5 |
| Quotation → Booking | **MISSING** | Bookings today come from the public `/cart` or admin "Create Booking from Enquiry" (PRs #91/#94); links `enquiryId`/`consultationId` only. | No quotation link on `Booking`; no "approved quote becomes booking context"; no duplicate-booking prevention (only duplicate *wedding*). | **P0** | Add `quotationId` link; block second booking per approved quote. | Booking test: two bookings from one quote → second rejected |
| Booking → Payment | **PARTIAL** (order settled: Booking → Wedding → Invoice → Payment) | Payments hang off `Invoice` → `Wedding` (`services/payment.service.ts`): Razorpay payment link per invoice, HMAC-verified webhook, idempotent on `Payment.razorpayPaymentId`, `payment_link.paid / expired` and `payment.failed` handled, receipts. Workspace paid/outstanding = sum of `Payment` rows. Decision 20 Sep 2026: payment comes after the Wedding. | `Booking` has `total` only — no advance/balance and no link to an Invoice; nothing turns an approved quotation's advance into an Invoice (proposed, see decision #3); **no way to record a cash/UPI/bank payment** (P0-5); no invoice due date. | **P0** | Add "Record payment" (manual `Payment` with `method`); decide auto-advance-invoice; add invoice due date. | Payment tests incl. duplicate webhook; Golden step "Record/verify payment" (now after Create Wedding) |
| Booking → Wedding | **DONE** | `services/weddingConversion.service.ts` `convertBookingToWedding`: advisory lock, `findWeddingForSource`, unique `sourceBookingId/EnquiryId/LeadId/ConsultationId` on `Wedding`. Staging check: 0 weddings sharing a source. PRs #92, #94, #95. | Minor race on `generateWeddingNumber` (count-then-insert) — P2. | — | Keep; fix P2 opportunistically. | `weddingConversion.service.test.ts` (exists, 5 files reference it) |
| Wedding → Operations | **PARTIAL** | Conversion seeds 1 `WeddingEvent`, default `TimelineMilestone`s and 1 task (`seedDefaultWeddingContent`). Staging: 0 weddings without events/milestones, 0 vendor bookings without an event. | Cannot add/edit events (P0-2); no document creation path (see Documents); vendor bookings have no availability check. | **P0** | See rows below. | Workspace test |
| Wedding → Completion | **BUG** | `services/weddingWorkspace.service.ts` `transitionStatus` → allowed if `canTransitionWedding` (`ACTIVE → COMPLETED`) only (`lib/wedding/lifecycle.ts`). | No check for outstanding invoice balance, open tasks, `PENDING_VENDOR_CONFIRMATION` bookings, or unpaid payouts. "No hidden pending work" not enforced. | **P0** | Add a completion guard returning a list of blockers (409). | Completion test: each blocker type prevents COMPLETED |

---

## 3. Module completion matrix (§3 / §8)

| Area | Status | Evidence / existing implementation | Missing / bug | Pri | Required action | Test |
|---|---|---|---|---|---|---|
| **Authentication / access** | **PARTIAL** | Auth.js v4 JWT, `maxAge` set (`lib/auth/auth.ts`); credentials login for SUPER_ADMIN/SALES/OPERATIONS; phone-OTP for VENDOR/CUSTOMER; login + OTP-verify lockout (`lib/auth/rateLimit.ts`); `proxy.ts` gates `/admin`, `/vendor`, `/customer`. **Verified 20 Sep:** SUPER_ADMIN and SALES both log in on production; unauthenticated `/admin`, `/vendor`, `/customer` redirect to login. | OTP delivery unverified (P0-7). No founder-only separation (decision #4). Session-expiry-mid-action not tested. | **P0** (OTP) / P1 | Test a real OTP to a phone that never messaged the business number; add an approved WhatsApp template if it fails. Decide role split. | Manual OTP test; role-matrix route tests |
| **CRM / Leads** | **PARTIAL** | Lead inbox, pipeline state machine (`lib/crm/pipeline.ts`), assign, notes, tasks, stage, convert (`app/api/crm/leads/**`), search/filter (`components/crm/LeadSearch.tsx`, `LeadFilters.tsx`), founder dashboard. All `requireRole(ADMIN_ROLES)`. | No duplicate detection; no Lead ↔ Consultation link; overdue SLA is a placeholder 24 h (`leadInbox.service.ts:179`). | P1 | Phone/email duplicate warning; confirm SLA rule with sales. | CRM tests |
| **Consultation** | **PARTIAL** | `/plan` → `POST /api/consultations` (rate-limited, Zod schema, `handleApiError`); admin list/PUT/DELETE guarded; guest-count-zero fix (PR #99); delete guard. | Several Enquiries per Consultation is intended (decision #2, resolved). `/plan` not re-verified end-to-end on the new production DB (a real submit creates data). | P1 | Re-verify `/plan` on staging/preview. | `app/api/consultations/*.test.ts` (2 exist) |
| **Enquiry** | **PARTIAL** | `POST /api/enquiries` public, rate-limited, schema; PUT/DELETE admin; status `NEW/CONTACTED/CLOSED` + `pipelineStage`. | Admin PUT status changes are **not** written to `ActivityLog` (see Activity). | P1 | Log status changes. | Service test |
| **Quotation** | **MISSING** | Model only. | Everything. | **P0** | See §2. | See §2 |
| **Booking** | **PARTIAL** | `enquiryId`/`consultationId` links + indexes (PR #92); `PUT /api/bookings/[id]` CONFIRMED triggers conversion; public `POST /api/bookings` has `schema.ts`. `BookingStatus` = `NEW/CONTACTED/CONFIRMED/CLOSED`. | **No duplicate-booking protection; no venue/date conflict protection** (`services/booking.service.ts` has neither). No CANCELLED state / rollback path. Public POST has no rate limit. | **P0** | Add exclusivity check + unique rule per approved quote; cancellation path. | Concurrency test: two bookings, same venue/date |
| **Wedding** | **PARTIAL** | Create-from-booking/lead DONE (§2). Statuses `PLANNING/ACTIVE/POSTPONED/COMPLETED/CANCELLED` with transition map; `PLANNING → ACTIVE` when first vendor confirms. | Completion guard missing (P0-4). `Wedding.totalBudget` is a single number. | **P0** | See §2. | Completion test |
| **Wedding Events** | **MISSING** (mutations) | `WeddingEvent` model + `weddingEvent.repository.ts`; created **only** inside conversion. `WeddingEvents.tsx` renders them. `weddingWorkspace.service` has no add/update/delete event function; no `/api/weddings/[id]/events` route. | Cannot create Haldi/Mehendi/Sangeet, edit date/time/venue, or delete. | **P0** | Add service + route + workspace form (events already have vendor/task FKs). | Event CRUD tests; Golden step 9 |
| **Vendors** | **PARTIAL** | Admin CRUD (`/api/vendors`), categories, status enum, applications → approval provisions Vendor + User + `VENDOR` role + `VendorProfile` in one transaction (`vendorApplication.service.ts`). Production now has 22 categories, 5 vendors. | Vendor OTP login unverified (P0-7). Public onboarding blocked until PR #102 (phone format; anonymous photo upload). | P1 | Merge/verify PR #102. | PR #102 tests |
| **Vendor Availability** | **MISSING** | Table `vendor_availability` with `@@unique([vendorId, date])`; enum `AVAILABLE/TENTATIVE/BOOKED/BLOCKED`. **Grep for `vendorAvailability.create/update/upsert/delete`: no hits.** Read-only in `founderDashboard.service.ts`, `venuePortal.service.ts`. 0 rows in staging/prod. | No writes, no auto-transition from VendorBooking, no vendor calendar UI, no conflict check on `addVendorBooking`. | **P0** | Service that sets TENTATIVE/BOOKED on vendor-booking create/confirm/cancel inside the same transaction; block conflicting dates. | Availability tests + concurrency test |
| **Vendor Booking** | **PARTIAL** | `addVendorBooking`, `updateVendorBookingStatus` with transition map (`lib/wedding/lifecycle.ts`), agreed price, payout per booking (unique `vendorBookingId`), venue status. | No availability check; no unique `(weddingEventId, vendorId)` (staging has 0 duplicates but nothing prevents them); agreed price not editable; no documents/tasks UI per booking. | **P0** | Tie to availability; add uniqueness. | Duplicate + availability tests |
| **Tasks / Timeline** | **PARTIAL** | `addTask`, `completeTask`, `updateMilestone`; `Task` has owner, due, priority, status, wedding/event/vendor-booking links. Command Center counts overdue/due-today/upcoming. | Overdue exists only as a Command-Center count, not per-task in the Workspace. No edit/reassign/delete task. `tasks` has no index on `dueAt`/`status`/`assignedToId`. Milestones cannot be created/dependency-linked in UI. | P1 | Overdue badge in workspace; edit/reassign; add indexes. | Task tests |
| **Payments / Finance** | **PARTIAL** | Razorpay payment links (`payment.service.ts`), HMAC-verified webhook (`app/api/payments/webhook`), idempotent on unique `Payment.razorpayPaymentId`, handles `payment_link.paid / expired`, `payment.failed`; receipts; paid = sum of `Payment` rows in the workspace (`weddingWorkspace.service.ts`). Staging: stored `Invoice.amountPaid` = summed payments on all wedding invoices. | **No manual payment recording** (P0-5). `Invoice` has no due-date column, so the Command Center's `duePayments[].dueAt` (present in its type) cannot carry a real due date. Invoice status only `DRAFT/SENT/PAID`. No refunds. Webhook check-then-insert: a concurrent duplicate hits the unique key and errors instead of no-op (integrity holds) — P2. | **P0** | "Record payment" (cash/UPI/bank) writing a `Payment` with `method`; add invoice due date. | Payment tests incl. duplicate webhook concurrency |
| **Wedding Workspace** | **PARTIAL** | `WeddingWorkspaceClient.tsx` + header, couple, events, milestones, finance, approvals, documents, guests, requirements. | No Pulse / Money / Attention / Next Action / Journey blocks (those words exist only in `components/crm/dashboard/CommandCenter.tsx`). No quick actions (Call/WhatsApp/Add Note/Record Payment). | P1 | Add Attention + Next Action + Money summary strip. | 30-second new-user test (§10 of handoff) |
| **Command Center** | **PARTIAL** | `commandCenter.service.ts`: new leads today, follow-ups due, tasks due, events today, upcoming events, task buckets, outstanding + due payments, recent payments, pipeline. | No explicit "active weddings" / "open enquiries" tiles; "payment due" lacks due dates (see Payments). | P1 | Add the two tiles; wire invoice due date. | Service test |
| **Activity / Audit** | **PARTIAL** | `ActivityLog` written by conversion, workspace mutations, payments, payouts, approvals, CRM lead workspace, lifecycle transitions. | Status changes made through admin `PUT` on **enquiries, consultations, bookings, invoices, vendors** are not logged (`grep activityLog` finds none in those services). | P1 | Log from/to status in those services. | Audit tests |
| **Documents** | **MISSING** (create) | `Document` model, categories, visibility; read paths in `weddingWorkspace`, `clientPortal`, `venuePortal` services; `Documents.tsx`. **No `document.create` call site** in services/routes; the only upload route (`/api/upload`) returns a URL and stores nothing. | Nothing can attach a document to a wedding/vendor booking; access control untestable. | P1 | Upload-and-attach service with per-wedding authorization. | Document access test (other wedding → 403/404) |
| **Client Portal** | **PARTIAL** | `clientPortal.service.ts` + `ClientPortalClient.tsx`: functions, services, tasks, finance/payment history, approvals (decide), guest RSVP, documents view. `requireRole(CUSTOMER)` and per-`customerId` scoping. | No quotation visibility (no quotation exists). | P1 | After P0-1. | Isolation test (Client A → Client B) |
| **Vendor Portal** | **PARTIAL** | `venuePortal.service.ts` + `VenuePortalClient.tsx`: assigned events, status update, availability (read), relevant approvals/documents, payments. Scoped by `VendorProfile`. | **No payout status** (0 mentions), no tasks, no updates feed; venue-flavoured (`VenueBookingStatus`). | P1 | Add payout status + tasks. | Isolation test (Vendor A → Vendor B) |
| **Notifications** | **PARTIAL** | `Notification` rows written by `approval.service.ts` (2 sites). WhatsApp used for OTP and consultation/booking messages (`lib/whatsapp.ts`). | Nothing reads or displays `Notification`; no channel delivery; no failure state. `lib/whatsapp.ts` logs message bodies when unconfigured with no environment guard (PII in logs) — P2. | P1 | In-app inbox + delivery status; guard the DEV log. | Notification tests incl. failure |
| **Mobile operational UX** | **UNVERIFIED** | Only 9 responsive-utility usages across `components/wedding/**`. | Needs a manual phone pass; quick actions absent. | P1 | Manual mobile checklist per Gate C. | Manual |

---

## 4. Database audit (§6) — staging schema, read-only

- **Foreign keys:** 90 in `public`. **57 FK columns have no index leading on that column.** Notable for the handoff's "high-use queries": `payments.invoiceId`, `invoice_items.invoiceId`, `vendor_bookings.weddingEventId/vendorId`, `tasks.weddingEventId/assignedToId/vendorBookingId`, `weddings.customerId/coordinatorId` (customer portal lookup), `notifications.userId`, `quotations.*`, `documents.vendorBookingId`. Already indexed: `weddings.source*` (unique), `wedding_events(weddingId,date)`, `tasks(weddingId,createdAt)`, `invoices(weddingId,createdAt)`, `bookings.enquiryId/consultationId`, `vendor_availability(vendorId,date)` (unique). **No index** on `tasks.dueAt/status`, `weddings.primaryDate`, `payments.status`. **Priority P2 at current volume** (tens of rows); make it a single migration before real load.
- **Unique constraints:** present for `Wedding` source links, `weddingNumber`, `Invoice.invoiceNumber`, `Payment.razorpayPaymentId`, `PaymentLink.razorpayPaymentLinkId`, `Payout(vendorBookingId)`, `VendorAvailability(vendorId,date)`, `GuestFunctionResponse(guestId,weddingEventId)`. **Missing:** `VendorBooking(weddingEventId, vendorId)`; any Booking uniqueness per quote/enquiry.
- **Integrity spot checks (staging):** 0 weddings without events; 0 without milestones; 0 vendor bookings without an event; 0 duplicate (event, vendor) pairs; 0 weddings sharing a source; 0 wedding invoices where stored `amountPaid` ≠ sum of payments. 2 invoices have no `weddingId` (legacy Mongo-era, expected).
- **Nullable fields / enums:** `Booking` has no CANCELLED status; `Invoice.eventDate` is a `String` (not a date); `InvoiceStatus` lacks a partial state (partial is derived from `outstanding`). Note only — no change proposed here.
- **Transaction boundaries:** conversion, payment webhook write, approvals, vendor-application approval all use `prisma.$transaction`. Vendor booking create and availability are not coupled (availability has no writer).
- **Migrations (Gate A):** 20 tracked migrations; a fresh empty production database applied 19 then the 20th cleanly (20 Sep). `postinstall` is `prisma generate` only — migrations are never auto-applied on deploy (deliberate; see deployment section).

## 5. Authentication, authorization and security (§7)

**Route guard scan** — every `app/api/**/route.ts` method was checked (script output kept in the audit session):

| Class | Result |
|---|---|
| Admin/back-office routes | All use `requireAdmin()` or `requireRole(ADMIN_ROLES)`. |
| Customer routes (`/api/customer/**`) | `requireRole([CUSTOMER])`, scoped by session user id. |
| Vendor route (`/api/vendor/bookings/[id]`) | `requireRole([VENDOR])`, scoped by `VendorProfile`. |
| Public by design | `categories`, `vendors`, `blogs`, `events` GET; `consultations`, `enquiries`, `vendor-applications`, `events/[id]/orders` POST (rate-limited); `bookings` POST and `leads` POST (**no rate limit**; `leads` uses only a hand-rolled "≥ 10 digits" phone check — no Zod schema, no `handleApiError`, and it stores the raw phone string un-normalized); `otp/*`; `rsvp/[token]` (token-scoped); `payments/webhook` (HMAC). |
| `/api/seed` | 404 in production; SUPER_ADMIN + `SEED_ENABLED` elsewhere. |

| Isolation attempt (handoff §7) | Result |
|---|---|
| User A → Wedding B | Customer/vendor services scope by session id (prior audit: no IDOR). Staff roles see all weddings by design. |
| Client A → Client B | Denied in code (per-`customerId` scoping). **No automated test** at route level. |
| Vendor A → Vendor B | Denied in code. **No automated test.** |
| Normal user → founder-only | **Not enforced** — `SALES` and `OPERATIONS` reach `/api/crm/founder-dashboard`, vendor approvals and stats (verified for SALES on production, 20 Sep). |
| Document access to another wedding | Untestable — no document write path exists. |

Security checklist: login/OTP-verify rate limiting ✔; security headers ✔ (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS) but **no CSP**; webhook HMAC + `timingSafeEqual` ✔; upload validation on `/api/upload` (type/size, admin-only) ✔ — public onboarding upload added in PR #102; **no secrets committed** (only `.env.example` tracked; pattern scan of tracked source clean); vendor bank details encrypted at rest (`lib/crypto`, backfill script exists) — key management not reviewed here; OTP dev-mode logging only when WhatsApp is unconfigured and not in production ✔, but `lib/whatsapp.ts:8` logs message bodies unguarded (P2).

## 6. Business rules (§9)

| Rule | Status |
|---|---|
| Confirmed venue/date cannot be double-booked | **MISSING** (P0-3) |
| Payment webhook idempotent | **DONE** (unique `razorpayPaymentId` + pre-check; concurrent duplicate errors rather than no-ops — P2) |
| Booking cannot create multiple weddings | **DONE** |
| Paid/pending from one source of truth | **DONE for wedding invoices** (sum of `Payment`); legacy non-wedding invoices fall back to stored `amountPaid` (`commandCenter.service.ts`) |
| User accesses only authorized records | **PARTIAL** (code yes; founder-only and tests missing) |
| Important state changes in ActivityLog | **PARTIAL** (see Activity) |
| Critical calculations validated server-side | **PARTIAL** — invoice totals server-side; quotation totals don't exist yet |

## 7. API standards (§11)

`handleApiError` (`lib/errors.ts`) maps Zod → 400 with `issues`, NotFound → 404, Duplicate/ConversionLocked → 409, InvalidTransition → 400 (**not** 409/422), else 500 with a generic message. Older routes (`leads`, `admin/*`) return hand-built shapes; responses are `{success, data|error}` almost everywhere. Zod errors are **not logged** server-side (only the client sees `issues`). **P2:** move `leads` POST onto a Zod schema + `handleApiError` + the shared phone normalizer (PR #102's `lib/indianPhone.ts`) and add a rate limit; map `InvalidTransitionError` to 409.

## 8. Testing (§12–13)

- **31 test files, 274 tests** (`bun test`): 13 service suites, route tests for `bookings`, `consultations`, `enquiries`, `vendor-applications`, `otp/send`, `events/[id]/orders`, plus lifecycle/crypto/security-header unit tests. `tsc --noEmit` clean; lint baseline 55 (11 errors, 44 warnings).
- **Missing:** any DB-backed integration or E2E harness (`package.json` has none); route tests for `weddings/**`, `crm/**`, `customer/**`, `vendor/**`, `payments/webhook`; concurrency tests (two users same venue/date, duplicate webhook); isolation tests; the Golden test.
- **No CI:** `.github/` contains only a PR template — no workflow runs tests/tsc/lint/build on PRs (only the Vercel build runs). **P1** for Gate A.
- **Seed/staging:** no deterministic seed for the Rahul & Priya scenario; `scripts/*` are one-off content scripts and the migration tool. Staging holds 1 wedding, 26 consultations, 8 bookings (mixed test data). **P0-6.**

## 9. Deployment readiness (§14 / Gate D)

| Item | Status |
|---|---|
| Production DB = intended DB | **DONE (20 Sep)** — Vercel Production points at `shaadishopping-prod` (Mumbai), 20/20 migrations. Free tier: auto-pauses after inactivity — upgrade before real use. |
| Admin login | **DONE** — SUPER_ADMIN and SALES verified live. |
| Database core reads | **DONE** — `/api/categories`, `/api/vendors`, `/sitemap.xml` 200. |
| Build / deploy | **DONE** — Vercel deploy of `main` succeeded. |
| `/plan` | **UNVERIFIED** on production (a submit writes data). |
| Cloudinary / WhatsApp / Razorpay env on Vercel Production | **UNVERIFIED** — no Vercel access from the audit session. |
| Env vars documented | **DONE** — every `process.env.*` read is in `.env.example` (only `NODE_ENV` is not). |
| Monitoring/logging | **PARTIAL** — Vercel logs only; Zod validation errors and 4xx are invisible (see §7). |
| Content | Production has 5 vendors, 0 blogs, 0 events, 0 weddings; blogs (47) not imported by decision. |

## 10. Documentation to finish (§16)

Exists: `README.md`, `CODEBASE_OVERVIEW.md`, `docs/architecture/*`, `docs/database/*` (migration/plan docs), `docs/deployment/*` (release + rollback checklists), `docs/security/security-checklist.md`, `docs/testing/performance-baseline.md`, `docs/wedding-os/*`.
**Missing:** `DATABASE_GUIDE` (schema rules + seed/reset), `ENVIRONMENT_SETUP`, `DEPLOYMENT_GUIDE` (staging vs production — now two separate Supabase projects), `TESTING_GUIDE` (+ Golden test), `ROLE_PERMISSION_GUIDE`, `PRODUCTION_RUNBOOK`. This file is `VIVAH_OS_TECH_COMPLETION.md`.

## 11. Suggested order against the October timeline (§17)

| Window | Work (P0 only unless noted) | Exit criterion |
|---|---|---|
| 20–26 Sep | Decisions #1–#3 resolved; #4 (role separation) still open. Quotation (P0-1) incl. approval + booking link and duplicate-booking guard. Real OTP test (P0-7). Merge/verify PR #102. Stand up the resettable staging seed + first DB-backed test (P0-6). | Consultation → Enquiry → Quotation → Booking passes on staging |
| 27 Sep–3 Oct | Wedding-event CRUD (P0-2), completion guard (P0-4), task edit/overdue in Workspace (P1), activity logging for admin PUT flows (P1). | A booked wedding is operable from one Workspace |
| 4–10 Oct | Availability service + double-booking protection (P0-3), vendor-booking uniqueness, vendor portal payout/tasks (P1). | Two concurrent bookings, one wins |
| 11–17 Oct | Manual payment recording + invoice due date (P0-5), client portal quotation view, documents attach path (P1), FK-index migration (P2). | Client and finance views agree |
| 18–24 Oct | Golden test repeatedly; mobile pass; CI workflow (P1). | Golden path green ×3 |
| 25–31 Oct | Freeze — blockers only. | Gates A–D |

## 12. How to update this file

For each change: status, one-line evidence (file/query/test command), date. Reporting format from the handoff (§18): *What I found · What I changed · Why · Tests · Risk · Next*. Re-run the route guard scan and the FK-index query (both are read-only) after any schema or route change.
