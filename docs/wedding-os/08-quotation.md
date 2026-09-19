# 08 — Quotation (functional design)

**Status: BUILT through S4 (20 Sep 2026); S5 pending.** Slices S1–S4 are open as stacked PRs **#105 → #106 → #107 →
#108** (see §13). This document was the design; it now also records what was built and where the build differs from
the original plan (§14). Nothing here has reached `main` or production yet — the production database still needs
S1's migration first (§13).

Closes P0-1 in `docs/VIVAH_OS_TECH_COMPLETION.md` (Enquiry → Quotation → Approval → Booking) and implements the
founding-team decisions of 20 Sep 2026: **Lead / Consultation / Enquiry stay parallel tables**, **several Enquiries per
Consultation**, **payment comes after the wedding**, and **an accepted quotation's advance becomes an Invoice
automatically** (payment link stays manual).

Principle (handoff §2): reuse what exists, put business rules on the server, no manual database repair.

---

## 1. Scope

**V1 (built):** a quotation with line items, server-side totals, discount, an optional typed tax amount, an advance
amount, a validity date; send, revise, accept, reject, expire; create a Booking from an accepted quotation; on
conversion to a Wedding, automatically create the advance Invoice; activity trail; staff UI in the CRM workspace.

**Not in V1:** PDF generation, e-signature, customer-portal quote view, multiple parallel options, automatic tax
percentages, quote templates, WhatsApp/email sending (staff copy a prepared message), AI drafting (`07-ai-assistant.md`),
cancelling an accepted quotation.

## 2. What existed before the build (verified) and what was reused

| Existing | Where | How it was used |
|---|---|---|
| `Quotation` model: source FKs, `amount`, `validUntil`, `status`, `pdfUrl`, `createdById` | `prisma/schema.prisma` | Extended. **0 rows in staging and production**, so reshaping needed no data migration (the migration aborts loudly if that ever stops being true). |
| `QuotationStatus` = `DRAFT SENT ACCEPTED REJECTED EXPIRED` | schema | `SUPERSEDED` added. |
| **No** service / repository / route / UI | grep of app, services, repositories, components | All new, following `route → service → repository` (`docs/architecture/repository-contract.md`). |
| Invoice creation: server-computed `total = subtotal − discount + gstAmount`; GST is a **typed amount**, never an auto-percentage (`06-finance.md` §5) | `weddingWorkspace.createInvoice` | Quotation uses the **same money convention**; the advance Invoice reuses `invoiceRepository.create`. |
| Conversion: `convertBookingToWedding` and `convertLeadToWedding`, one transaction behind an advisory lock, idempotent | `services/weddingConversion.service.ts` | The hook point for the automatic advance invoice (one shared helper called from both). |
| `Booking` (`enquiryId`, `consultationId`, `items[]`), admin "Create Booking from Enquiry" | schema, PRs #91/#94 | Booking gained `quotationId`; items are copied from the quote. |
| `ActivityLog` with lead/enquiry/consultation/wedding FKs | schema | Quote events log on the source entity, then on the wedding. |
| CRM pipeline state machine | `lib/crm/pipeline.ts` | Extended with one guarded, server-verified exception (§6.5). |
| `ApprovalRequest` with `subjectType = QUOTATION` | schema | **Not reusable.** `approval.service.create/decideForClient` require a Wedding, which does not exist at quote stage. Acceptance is recorded on the Quotation itself. |

## 3. Domain rules

**Ownership.** A quotation belongs to exactly one source: an Enquiry (per-vendor), a Consultation (multi-service brief)
or a Lead. The database enforces it with a `CHECK` (exactly one FK not null). The source FKs are **`ON DELETE RESTRICT`**,
and the Lead/Enquiry/Consultation delete guards refuse — with a clear message — when quotations exist (quotations are a
commercial record).

**Statuses and transitions**

| From | To | Trigger | Notes |
|---|---|---|---|
| — | `DRAFT` | create | editable; needs ≥ 1 line; blocked if the source already has an open or accepted quotation, or has converted to a Wedding |
| `DRAFT` | `SENT` | send | needs ≥ 1 line and a **future** `validUntil`; stored totals are re-checked against the lines; `sentAt` set |
| `SENT` | `ACCEPTED` | accept | only while inside `validUntil`; staff record channel + note, who and when |
| `SENT` | `REJECTED` | reject | reason required |
| `SENT` | `EXPIRED` | time | applied lazily whenever quotations are read or acted on (no scheduler in V1); frees the source's open slot |
| `SENT` | `SUPERSEDED` | **revise** | at the moment the revision draft is created (see below) |
| `SENT` / `REJECTED` / `EXPIRED` | new `DRAFT` | revise | copies the lines; `revision + 1`; new quotation number; fresh `validUntil` required before sending |
| `ACCEPTED`, `REJECTED`, `EXPIRED`, `SUPERSEDED` | — | terminal | immutable |

- **A `SENT` quote is never edited.** "Revise" copies it into a new `DRAFT` (`revision + 1`, `supersedesId` → old). Only one
  quotation per source may be open (`DRAFT` or `SENT`), so a `SENT` original is marked `SUPERSEDED` **when the revision
  draft is created**, not when it is later sent. **Discarding the revision draft restores the original** (sent again if its
  `validUntil` is still ahead, otherwise expired), so abandoning a revision never leaves the customer without a current
  quotation. A quote can be revised once; a `REJECTED`/`EXPIRED` original keeps its status as history.
- **At most one open (`DRAFT` or `SENT`) quotation per source, and at most one `ACCEPTED`** — enforced by partial unique
  indexes in the database, plus advisory locks on the source and the quotation for every mutation.
- Once a source has an `ACCEPTED` quotation it cannot be revised or rejected and no further quotation can be created for it.
  Cancelling an accepted quote is a booking-cancellation question and is out of V1.
- Only a `DRAFT` can be deleted; anything that was sent is kept as history. Deleting a revision draft restores its predecessor.

## 4. Data model (as built — migration `20260920130000_add_quotation_workflow`)

```prisma
enum QuotationStatus { DRAFT SENT ACCEPTED REJECTED EXPIRED SUPERSEDED }

model Quotation {
  id              String     @id @default(uuid())
  quotationNumber String     @unique                  // QTN-YYYYMM-NNNN
  revision        Int        @default(1)
  supersedesId    String?    @unique                  // the revision this one replaces
  supersedes      Quotation? @relation("QuotationRevision", ...)
  supersededBy    Quotation? @relation("QuotationRevision")

  leadId / enquiryId / consultationId                 // exactly one (DB CHECK); FKs ON DELETE RESTRICT
  status          QuotationStatus @default(DRAFT)

  subtotal        Int                                 // Σ unitPrice × quantity   (server-computed)
  discount        Int             @default(0)
  gstEnabled      Boolean         @default(false)     // NOT defaulted on — see §5
  gstAmount       Int             @default(0)         // typed by staff, like Invoice
  total           Int                                 // subtotal − discount + gstAmount
  advanceAmount   Int             @default(0)         // 0 ≤ advance ≤ total
  validUntil      DateTime?
  terms           String?                             // shown to the customer
  notes           String?                             // internal, never shown
  pdfUrl          String?                             // reserved; no PDF in V1

  sentAt DateTime?
  acceptedAt DateTime?  acceptedById String? (→ User)  acceptedChannel String?  acceptedNote String?
  rejectedAt DateTime?  rejectionReason String?

  advanceInvoiceId String?  @unique                   // idempotency anchor for the automatic invoice
  advanceInvoice   Invoice?                           // Invoice.advanceForQuotation is the back-relation
  booking          Booking?                           // Booking.quotationId is @unique
  items            QuotationItem[]
  createdById String? (→ User)
  createdAt DateTime  updatedAt DateTime

  @@index([leadId]) @@index([enquiryId]) @@index([consultationId]) @@index([status, validUntil])
}

model QuotationItem {
  id; quotationId (CASCADE); sortOrder Int
  description String            // e.g. "Grand Ballroom — 500 guests"
  category String?              // Venue / Catering / Decoration …
  functionLabel String?         // "Sangeet" — informational until a Wedding exists
  vendorId String? (→ Vendor)   // null = custom line; a vendor is assigned after conversion
  unitPrice Int   quantity Int @default(1)
  @@index([quotationId]) @@index([vendorId])
}

// Booking:  quotationId String? @unique  (one Booking per quotation)
// ActivityType: + QUOTATION_SENT, QUOTATION_ACCEPTED, QUOTATION_REJECTED, QUOTATION_REVISED, INVOICE_CREATED
```

**Database guarantees Prisma cannot express, added by hand in the migration:**
- `CHECK` exactly one of `leadId` / `enquiryId` / `consultationId` is set;
- partial unique index — one **open** (`DRAFT`/`SENT`) quotation per source;
- partial unique index — one **`ACCEPTED`** quotation per source;
- money identity `CHECK`: `total = subtotal − discount + gstAmount`, `discount ≤ subtotal`, `advanceAmount ≤ total`, none negative;
- item `CHECK`: `unitPrice ≥ 0`, `quantity ≥ 1`;
- a guard that aborts the migration if `quotations` is not empty (the new NOT NULL columns have no defaults).

The migration is tracked and was applied to **staging**; it has **not** been applied to production.

## 5. Money rules (server-side only)

All amounts are **integer rupees**, like `Invoice`. The API accepts *inputs* (items, discount, GST amount, advance,
dates) and **never accepts totals** — an unknown `total` key is stripped by the schema; totals are recomputed on every
write by `lib/quotation/totals.ts`, and the database's money `CHECK` backs the same identity up.

```
lineTotal = unitPrice × quantity                      (unitPrice ≥ 0, quantity ≥ 1)
subtotal  = Σ lineTotal
0 ≤ discount ≤ subtotal
total     = subtotal − discount + gstAmount            (gstAmount ≥ 0, typed; gstEnabled just labels it)
0 ≤ advanceAmount ≤ total ;  balance = total − advanceAmount   (balance is derived, not stored)
```

Money columns are 32-bit Postgres `INTEGER`, so the totals function refuses anything that could overflow: total ≤ ₹200 crore
(2,000,000,000), unit price ≤ ₹10 crore, quantity ≤ 100,000, at most 50 lines. Violations are `ValidationError` (HTTP 400)
with a message that names the offending line. A tax amount can only be entered when tax is switched on. **No tax
percentage is calculated** — same restraint as `06-finance.md` §5: GST treatment is a compliance question for the CA.

## 6. Flows

### 6.1 Create / edit (DRAFT)
Staff opens the lead/enquiry/consultation in the CRM workspace → **Create quote** → editor: lines, discount, optional tax
amount, advance (₹, with 25/30/50 % shortcuts that fill the ₹ amount), valid until, terms, internal note. Enquiry-sourced
quotes pre-fill the vendor line; consultation-sourced quotes start from its service list. A live totals preview is shown
while typing — **only a preview**; every save recomputes and stores the real totals on the server.

### 6.2 Send
`DRAFT → SENT` in one transaction behind advisory locks: validate (≥ 1 line, future `validUntil`, stored totals equal a
fresh calculation), set `sentAt`, log `QUOTATION_SENT` on the source. The UI then offers a **prepared message** (Copy /
Open WhatsApp to the customer's number). V1 sends nothing by itself. The message always gives **Shaadi Shopping's own
number**, never a venue's, and never uses the word "marketplace". After the send the source moves to `QUOTATION_SENT`
**only if the pipeline state machine allows it from its current stage**; the response reports `stageAdvanced`, and a refusal
never fails the send.

### 6.3 Accept / reject (decided — §11 Q1: staff-recorded in V1)
Staff record the customer's answer **on their behalf**: channel (WhatsApp / phone / in person / other) and an optional
note for an acceptance, a reason for a rejection; the system stores who and when. Acceptance is refused once
`validUntil` has passed (an unmarked expiry is caught and persisted at that moment). The customer has no login at quote
stage, so this mirrors how the sale really happens. **No customer login and no customer accept link in V1.**

### 6.4 Create Booking from an accepted quotation
`POST /api/quotations/[id]/create-booking`, available only on `ACCEPTED`. Creates a `Booking` (`NEW`) with `quotationId`
(unique → a second attempt fails cleanly, at a locked check and again at the database), the source's
`enquiryId`/`consultationId`, and `BookingItem`s copied from the quote lines (`price = unitPrice`, `quantity`). **Prices
come from the quote, not from `VendorPackage`** — the negotiated price, unlike the marketplace cart path in
`bookingService.create`. `Booking.total = quotation.total` (discount/tax live on the quote, linked).
- Client name, phone, city, guest count and event type come from the enquiry/consultation; staff supply **only what is
  missing** (optional `weddingDate`, `guestCount`, `weddingType`, `city`).
- **Dates:** `Enquiry.eventDate` and `Consultation.weddingDate` are free text, and JS parses typos like "20 October 20202"
  into a valid date 18,000 years away. Only an **exact, plausible `YYYY-MM-DD`** (years 2020–2100, no rollovers such as
  31 Feb) is trusted; otherwise the request fails with a clear message and staff enter the date — so a booking can never
  get stuck at conversion for lack of one.
- **Lines:** a line with a vendor takes that vendor's name and category; a custom line becomes a `"To be assigned"` item
  (`lib/booking/unassigned.ts`) and conversion turns it into an "Assign a vendor" task. A vendor that has since been removed
  is an error, never silently turned into an unassigned line.
- Lead-sourced quotations are **not** booked here — a lead converts to a wedding through the CRM.
- The event is logged on the source. Confirming the booking uses the existing `PUT /api/bookings/[id]` →
  `convertBookingToWedding`; the panel's **Confirm booking & create wedding** button calls exactly that.

### 6.5 Pipeline coupling (CRM)
**Decided (§11 Q2): `QUOTATION_SENT → WON` is allowed when an accepted quotation exists.** Enforced **on the server**:
`lib/crm/pipeline.ts` gains `canTransitionWithContext` / `allowedNextStages`, and `leadWorkspaceService.transitionStage`
looks up an `ACCEPTED` quotation in the database for exactly that one move and refuses it otherwise, with a message
pointing to recording the acceptance (or moving via Negotiation). The base transition map is **unchanged**. The stage
control's "Booked" (`WON`) option is display-only, fed by a `hasAcceptedQuotation` flag the server puts on the workspace;
the frontend can never change the stage on its own.

### 6.6 Automatic advance invoice — inside conversion
`ensureAdvanceInvoice(tx, { wedding, quotation, client, actorId })` (`services/advanceInvoice.service.ts`) is called from
**both** conversion paths after the Wedding and its events exist, **inside the existing transaction and advisory lock**:

- **Booking path** (`convertBookingToWedding`): quotation = `booking.quotationId`.
- **CRM path** (`convertLeadToWedding`): the source's `ACCEPTED` quotation, if any.

Rules (pure decision in `lib/quotation/advanceInvoice.ts`):
1. Quotation missing or not `ACCEPTED` → nothing. `advanceAmount = 0` → nothing.
2. `quotation.advanceInvoiceId` already set → nothing (**idempotent**; `advanceInvoiceId` is `@unique`).
3. Otherwise create one `Invoice` in `DRAFT`: client name/phone/email/city from the booking or the converting source,
   `eventDate`/`eventType` from the wedding, **one line** "Advance — QTN-…" for `advanceAmount`, `total = advance`,
   `discount = 0`, **`gstEnabled = false`, `gstAmount = 0`** (**decided — §11 Q4: no tax in V1**; nothing about GST is
   invented, revisit after accounting/CA confirmation), a note naming the quote and its total; store its id in
   `quotation.advanceInvoiceId`; log `INVOICE_CREATED` on the wedding.
4. **The Razorpay payment link is not created here.** It is an external call that must never run inside a database
   transaction; staff use the existing "Create payment link" action on the invoice. The balance invoice stays manual.
5. **Atomic:** if any of this fails, the **whole conversion rolls back** — a wedding never exists without the invoice its
   accepted quotation promised — and the same call can simply be retried.
6. Not retroactive: weddings converted before this shipped get no advance invoice.

```
Enquiry/Consultation ──create──▶ Quotation DRAFT ──send──▶ SENT ──accept──▶ ACCEPTED
                                                                              │ create booking
                                                                              ▼
                                                                    Booking NEW ──confirm──▶ CONFIRMED
                                                                              │ convertBookingToWedding (tx + lock)
                                                                              ▼
                              Wedding + events + vendor bookings + tasks + advance Invoice (DRAFT)
                                                                              │ staff: Create payment link (manual)
                                                                              ▼
                                                                      Razorpay webhook → Payment
```

## 7. Changes to existing code (all done, each with a test)

| # | Change | Status |
|---|---|---|
| 1 | Conversion set `agreedPrice: item.price` and ignored `quantity` — "500 plates × ₹800" became a ₹800 vendor booking. Now `price × quantity` (`lib/booking/unassigned.ts`, `agreedPriceFor`). | **Done — S3.** Regression-checked: with the fix reverted, the new tests fail. |
| 2 | Invoice and wedding numbers were count-then-insert, which collides when two transactions run at once (failing one conversion once the invoice lives inside it) and can duplicate after a delete. Now **highest existing + 1 under a transaction-scoped advisory lock** (`lib/numbering.ts`, `services/documentNumber.service.ts`) for `INV-`, `WED-` and `QTN-`. | **Done — S1 (`QTN-`), S4 (`INV-`, `WED-`).** Limit: correct up to 9,999 per bucket (text ordering). |
| 3 | A quote line with no vendor reused the "vendor no longer exists" wording. Now "No vendor assigned yet…" plus an "Assign a vendor" task; the original wording is kept for a genuinely removed vendor. | **Done — S3.** |
| 4 | `Booking.quotationId`, new `ActivityType` values, `SUPERSEDED`, hand-written DB guarantees. | **Done — S1.** |
| 5 | `QUOTATION_SENT → WON` only when the server finds an `ACCEPTED` quotation. | **Done — S2.** |
| 6 | **Conversion transactions get `maxWait 10 s / timeout 30 s`** — Prisma's default 5 s interactive-transaction limit expired when a second conversion waited on the numbering lock ("Transaction API error"), found by testing on staging. | **Done — S4.** New. |
| 7 | New `ValidationError` (400) and `ConflictError` (409) so quotation rules return honest status codes. | **Done — S1.** |

## 8. API (as built — all `requireRole(ADMIN_ROLES)`; Zod schemas; `handleApiError`)

| Method & path | Purpose |
|---|---|
| `GET /api/quotations?sourceType=&sourceId=` | list for a lead/enquiry/consultation (`sourceType` = `LEAD` \| `ENQUIRY` \| `CONSULTATION`) |
| `POST /api/quotations` | create a DRAFT (`sourceType`, `sourceId`, items, discount, tax, advance, …) |
| `GET /api/quotations/[id]` | detail with items, computed balance, linked booking and advance invoice |
| `PATCH /api/quotations/[id]` · `DELETE /api/quotations/[id]` | edit / delete a DRAFT only |
| `POST /api/quotations/[id]/send` | `DRAFT → SENT`; response includes `stageAdvanced` |
| `POST /api/quotations/[id]/revise` | new draft from a sent / rejected / expired quotation |
| `POST /api/quotations/[id]/accept` | body `{ channel, note? }` |
| `POST /api/quotations/[id]/reject` | body `{ reason }` |
| `POST /api/quotations/[id]/create-booking` | from `ACCEPTED` only; optional `{ weddingDate, guestCount, weddingType, city }` |

**400** `ValidationError` / Zod (`issues` name the field) · **401** no session · **404** not found · **409** `ConflictError`
(wrong state, already booked, duplicate) or `ConversionLockedError`. Responses keep the `{ success, data | error }` shape.
`InvalidTransitionError` still maps to 400 (unchanged; audit §7 P2) — quotation conflicts use the new 409 class.

## 9. UI (as built — human language, one primary action per screen)

- **Where:** a **Quote** panel in the CRM lead workspace (`components/crm/workspace/QuotationPanel.tsx`), shown for every
  source type — Enquiry, Consultation and Lead — not on the admin enquiry cards as first sketched. It becomes read-only once
  the source converts to a Wedding.
- **Editor:** lines (description, function, quantity, price) → discount, valid until, advance (₹ or 25/30/50 %) → optional
  typed tax amount → terms and internal note → a live **Total · Advance · Balance** strip (preview only).
- **Actions by status:** Draft — *Send quote · Edit · Delete draft / Discard revision*; Sent — *Copy message · Open WhatsApp ·
  Customer accepted · Customer declined · Revise*; Accepted — *Create booking* (prefilled from the source; asks only for what
  is missing), then *Confirm booking & create wedding*, and the advance invoice number once it exists; Declined / Expired —
  *Revise*.
- The stage control offers **Booked** from *Quotation Sent* only when the server reports an accepted quotation.
- After conversion, the Wedding Workspace Finance panel shows the advance invoice with the existing **Create payment link**
  action. Terms shown: *Quote, Advance, Balance, Valid until* — never `QuotationStatus`/`advanceInvoiceId`.
- Type-checked, linted and built, but **not yet clicked through in a browser**; mobile layout uses responsive grid classes
  and is unverified.

## 10. Security

Staff-only V1 (`ADMIN_ROLES`; the SUPER_ADMIN / SALES / OPERATIONS split is open audit decision #4). Quotes contain pricing,
so **no public route exists**; a later customer link would need an unguessable token, a read-only view, a rate limit and
expiry. Every mutation writes `ActivityLog` (who/what/when). Money is validated on the server and by database `CHECK`s; a
client-sent total is never read.

## 11. Decisions (confirmed 20 Sep 2026)

| # | Question | Decision | As built |
|---|---|---|---|
| Q1 | Who records acceptance in V1? | **Staff record it** on the customer's behalf (WhatsApp / phone / in person). **No customer login or accept link at this stage.** | `accept` with channel + note; §6.3 |
| Q2 | Allow `QUOTATION_SENT → WON` when an `ACCEPTED` quote exists? | **Yes**, verified **server-side**. | §6.5; tested against the real database |
| Q3 | Advance entered as fixed ₹ or %? | *Not asked; proceeded on the recommendation:* store the ₹ amount; the editor offers % shortcuts that fill it. Change on request. | 25 / 30 / 50 % buttons |
| Q4 | Tax on the automatic advance invoice | **No tax in V1** — `gstEnabled = false`, `gstAmount = 0`. Revisit after accounting/CA confirmation. | §6.6 |
| Q5 | Quotes from Leads? | *Not asked; proceeded on the recommendation:* the API accepts them. **Deviation:** the panel appears for Leads too (§14). Booking from a lead quote is not offered (§6.4). | §9 |

Standing rules from the audit, all honoured: `agreedPrice` respects quantity; invoice numbering made race-safe **before** the
invoice is created transactionally; **payment-link creation stays outside the database transaction**; **no parallel approval
structure**; **no manual database repair** (tracked migrations only: schema → migration → staging → tests → production).

## 12. Tests

**Committed (`bun test`: 531 pass across 46 files at S4; `main` baseline 274 / 31):**
- **Unit:** money totals (limits, overflow, discount/advance bounds); race-safe number generators (lock before read, highest + 1);
  status rules (send / accept / reject / revise / edit / delete / book); pipeline rule (`QUOTATION_SENT → WON` only with context,
  base map unchanged); booking plan (dates, vendors, unassigned lines, overrides); advance-invoice decision and plan; the customer
  message; the Zod schemas.
- **Route:** every quotation route — 401 without a session, schema errors return `issues`, service errors map to 400/404/409, a
  client-sent total never reaches the service.
- **Conversion (mocked, existing pattern):** advance invoice created once, after the wedding, inside one transaction, no tax, no
  network call; skipped when not accepted / zero advance / already created; failure aborts the conversion; retry creates nothing;
  both conversion paths; wedding-number bucket lock ordering; `agreedPrice × quantity`; vendor-less wording.

**Verified against the real staging database (temporary scripts, not committed):** 16 database-constraint checks (rolled back) and
19 / 37 / 22 / 23 service checks for S1 / S2 / S3 / S4, including **3 simultaneous creates, sends, accepts, revisions and
create-booking calls → exactly one succeeds**, **two different weddings converting at once → both succeed with distinct wedding and
invoice numbers**, the server-refused stage jump, lazy expiry, and a **forced failure that rolls the whole conversion back and then
succeeds on retry**. Every script restored staging (table counts identical before and after).

**Still to do (S5, needs the real-database harness — audit P0-6):** turn those checks into committed, repeatable tests, and add the
Golden-test steps *Create Quotation → Approve → Create Booking → Confirm → Create Wedding → advance Invoice exists → Record/verify
payment* (payment after the wedding, per the decision).

## 13. Build status

| Slice | Content | PR | Status |
|---|---|---|---|
| **S1** | Migration (model, items, CHECKs, partial unique indexes), totals, race-safe `QTN-` numbering, draft create / edit / list / delete, Lead/Enquiry/Consultation delete guards, `ValidationError` / `ConflictError`, CRM panel | #105 | Built; PR open |
| **S2** | Send / revise / accept / reject / expire, activity trail, prepared message, **server-verified `QUOTATION_SENT → WON`** | #106 (stacked) | Built; PR open |
| **S3** | Booking from an accepted quotation, `agreedPrice × quantity`, vendor-less line wording | #107 (stacked) | Built; PR open |
| **S4** | **Automatic advance invoice** in both conversions, race-safe `INV-` / `WED-` numbering, conversion transaction timeouts | #108 (stacked) | Built; PR open |
| **S5** | Committed real-database concurrency tests + Golden-test steps, docs (`ROLE_PERMISSION_GUIDE`, testing guide) | — | Not started |

**Merge gate:** the stack merges in order #105 → #106 → #107 → #108. Production deploys from `main`, so **S1's migration must be
applied to `shaadishopping-prod` first** (20/20 → 21/21) — same order as PR #101. It has not been applied. S2–S4 add no migration.

## 14. Deviations from the original design (for reviewers)

1. **Revision timing.** Designed: the old quote becomes `SUPERSEDED` when the revision is *sent*. Built: when the revision draft is
   *created*, because the "one open quotation per source" database rule makes a draft and a sent original mutually exclusive;
   discarding the draft restores the original (§3). Revisions are also allowed from `REJECTED` / `EXPIRED`, and each revision gets
   its own quotation number.
2. **List endpoint.** Designed `?enquiryId|consultationId|leadId=`; built `?sourceType=&sourceId=` (reuses the CRM's existing
   `SourceType`).
3. **UI location and Leads.** Designed on the admin enquiry/consultation cards, Leads API-only; built in the CRM lead workspace for
   all three source types.
4. **Numbering scope.** Designed race-safe invoice numbering; built for invoices, weddings and quotations alike (one shared
   mechanism).
5. **Conversion transaction timeouts** were not in the design; added after the staging run showed the 5 s default expiring (§7 #6).
6. **Extra database guarantees** beyond the design: money and item `CHECK`s, `ON DELETE RESTRICT` on the source FKs, and the
   empty-table migration guard.
7. **Money limits** (§5) and "a draft needs at least one line; `validUntil` is required only to send" were not specified originally.
8. **Booking creation** accepts optional overrides and refuses unclear source dates (§6.4) — the design only said the data comes from
   the source.
