# 08 — Quotation (functional design)

**Status: DESIGN — decisions confirmed 20 Sep 2026 (§11); implementation proceeds slice by slice (§13).** Written against `main` @ `ab416c3`.
Closes P0-1 in `docs/VIVAH_OS_TECH_COMPLETION.md` (Enquiry → Quotation → Approval → Booking) and implements the
founding-team decisions of 20 Sep 2026: **Lead / Consultation / Enquiry stay parallel tables**, **several Enquiries per
Consultation**, **payment comes after the wedding**, and **an accepted quotation's advance becomes an Invoice
automatically** (payment link stays manual).

Principle (handoff §2): reuse what exists, put business rules on the server, no manual database repair.

---

## 1. Scope

**V1 (this design):** a quotation with line items, server-side totals, discount, an optional typed tax amount, an
advance amount, a validity date; send, revise, accept, reject, expire; create a Booking from an accepted quotation; on
conversion to a Wedding, automatically create the advance Invoice; activity trail; admin UI.

**Not in V1:** PDF generation, e-signature, customer-portal quote view, multiple parallel options, automatic tax
percentages, quote templates, WhatsApp/email sending (staff copy a prepared message), AI drafting (`07-ai-assistant.md`).

## 2. What already exists (verified) and what is reused

| Existing | Where | How the design uses it |
|---|---|---|
| `Quotation` model: source FKs (`leadId`/`enquiryId`/`consultationId`, "exactly one" only by convention), `amount`, `validUntil`, `status`, `pdfUrl`, `createdById` | `prisma/schema.prisma` | Extended, not replaced. **0 rows in staging and production**, so reshaping it needs no data migration. |
| `QuotationStatus` = `DRAFT SENT ACCEPTED REJECTED EXPIRED` | schema | Add `SUPERSEDED` (revisions). |
| **No** service / repository / route / UI | grep of app, services, repositories, components | All new; follow the `route → service → repository` pattern in `docs/architecture/repository-contract.md`. |
| Invoice creation: server-computed `total = subtotal − discount + gstAmount`; GST is a **typed amount**, never an auto-percentage (`06-finance.md` §5) | `weddingWorkspace.createInvoice` | Quotation uses the **same money convention**; the advance Invoice reuses `invoiceRepository.create` + `generateInvoiceNumber`. |
| Conversion: `convertBookingToWedding` (booking `CONFIRMED`) and `convertLeadToWedding` (CRM stage `WON`), both in one transaction behind an advisory lock, idempotent | `services/weddingConversion.service.ts` | The **hook point** for the automatic advance invoice (one shared helper called from both). |
| `Booking` (`enquiryId`, `consultationId`, `items[]`), admin "Create Booking from Enquiry" | schema, PRs #91/#94 | Booking gains `quotationId`; items are copied from the quote. |
| `ActivityLog` with lead/enquiry/consultation/wedding FKs | schema | Quote events log on the source entity, then on the wedding. |
| CRM pipeline state machine (`QUOTATION_SENT`, `NEGOTIATION`, `WON`, …) | `lib/crm/pipeline.ts` | Coupled loosely — see §6.5. |
| `ApprovalRequest` with `subjectType = QUOTATION` | schema | **Not reusable here.** `approval.service.create/decideForClient` require a Wedding, which does not exist at quote stage. Acceptance is recorded on the Quotation itself. |

## 3. Domain rules

**Ownership.** A quotation belongs to exactly one source: an Enquiry (per-vendor), a Consultation (multi-service brief)
or a Lead. The database enforces it with a `CHECK` (exactly one FK not null) — not just convention. The UI creates
quotes from Enquiry and Consultation cards; Lead is allowed by the API but not surfaced in V1.

**Statuses and transitions**

| From | To | Trigger | Notes |
|---|---|---|---|
| — | `DRAFT` | create | editable |
| `DRAFT` | `SENT` | send | totals frozen; `sentAt` set; needs ≥ 1 item and a valid `validUntil` |
| `SENT` | `ACCEPTED` | accept | only if not past `validUntil`; records who/when/channel |
| `SENT` | `REJECTED` | reject | reason required |
| `SENT` | `EXPIRED` | time | evaluated lazily on read/accept (no scheduler in V1) |
| `SENT` | `SUPERSEDED` | a newer revision is sent | same transaction as the new quote's `SENT` |
| `ACCEPTED`, `REJECTED`, `EXPIRED`, `SUPERSEDED` | — | terminal | immutable |

- **A `SENT` quote is never edited.** "Revise" copies it into a new `DRAFT` (`revision + 1`, `supersedesId` → old); when
  the revision is sent, the old one becomes `SUPERSEDED`. This is the revision history the handoff asks for.
- **At most one open (`DRAFT` or `SENT`) quotation per source**, and **at most one `ACCEPTED`**. Enforced by partial
  unique indexes (hand-written in the migration) plus the advisory lock helper already used by conversion.
- Once a source has an `ACCEPTED` quotation it cannot be revised. Cancelling an accepted quote is a booking-cancellation
  question and is out of V1.

## 4. Data model (proposed)

```prisma
enum QuotationStatus { DRAFT SENT ACCEPTED REJECTED EXPIRED SUPERSEDED }

model Quotation {
  id              String          @id @default(uuid())
  quotationNumber String          @unique          // QTN-YYYYMM-NNNN, same scheme as INV-/WED-
  revision        Int             @default(1)
  supersedesId    String?         @unique          // previous revision
  supersedes      Quotation?      @relation("QuotationRevision", fields: [supersedesId], references: [id])
  supersededBy    Quotation?      @relation("QuotationRevision")

  leadId / enquiryId / consultationId              // existing; DB CHECK: exactly one
  status          QuotationStatus @default(DRAFT)

  subtotal        Int                              // Σ unitPrice × quantity   (server-computed)
  discount        Int             @default(0)
  gstEnabled      Boolean         @default(false)  // NOT defaulted on — see §5
  gstAmount       Int             @default(0)      // typed by staff, like Invoice
  total           Int                              // subtotal − discount + gstAmount
  advanceAmount   Int                              // 0 ≤ advance ≤ total
  validUntil      DateTime?
  terms           String?
  notes           String?                          // internal

  sentAt DateTime?
  acceptedAt DateTime?  acceptedById String?  acceptedChannel String?  acceptedNote String?
  rejectedAt DateTime?  rejectionReason String?

  advanceInvoiceId String?  @unique                // idempotency anchor for the auto invoice
  advanceInvoice   Invoice? @relation(fields: [advanceInvoiceId], references: [id])
  booking          Booking?
  items            QuotationItem[]
  createdById String? / createdBy User?
  createdAt DateTime @default(now())  updatedAt DateTime @updatedAt
  // pdfUrl kept but unused in V1; `amount` replaced by subtotal/discount/gst/total (table is empty)
  @@index([leadId]) @@index([enquiryId]) @@index([consultationId]) @@index([status, validUntil])
  @@map("quotations")
}

model QuotationItem {
  id String @id @default(uuid())
  quotationId String   quotation Quotation @relation(fields:[quotationId], references:[id], onDelete: Cascade)
  sortOrder Int
  description String                                // e.g. "Grand Ballroom — 500 guests"
  category String?                                  // Venue / Catering / Decoration …
  functionLabel String?                             // "Sangeet" — informational until a Wedding exists
  vendorId String?  vendor Vendor? @relation(...)   // null = custom line, vendor to be assigned
  unitPrice Int
  quantity Int @default(1)
  @@index([quotationId]) @@map("quotation_items")
}

// Booking:  quotationId String? @unique  + relation   (one Booking per quotation)
// ActivityType: + QUOTATION_SENT, QUOTATION_ACCEPTED, QUOTATION_REJECTED, QUOTATION_REVISED, INVOICE_CREATED
```

Migration is tracked and additive except reshaping the empty `quotations` table. FK columns get indexes (the audit found
the existing `quotations` FKs unindexed).

## 5. Money rules (server-side only)

All amounts are **integer rupees**, like `Invoice`. The API accepts *inputs* (items, discount, GST amount, advance,
dates) and **never accepts totals**; they are recomputed on every write.

```
lineTotal = unitPrice × quantity                      (unitPrice ≥ 0, quantity ≥ 1)
subtotal  = Σ lineTotal
0 ≤ discount ≤ subtotal
total     = subtotal − discount + gstAmount            (gstAmount ≥ 0, typed; gstEnabled just labels it)
0 ≤ advanceAmount ≤ total ;  balance = total − advanceAmount   (balance is derived, not stored)
```

A pure function `calculateQuotationTotals(input)` owns this and is the most heavily unit-tested piece. Upper bounds
guard against absurd values. **No tax percentage is calculated** — same restraint as `06-finance.md` §5: GST treatment
is a compliance question for the CA, not something the product defaults.

## 6. Flows

### 6.1 Create / edit (DRAFT)
Staff opens an Enquiry or Consultation → **Create quote** → editor: lines, discount, tax amount, advance, valid until,
terms. Enquiry-sourced quotes pre-fill the vendor line from the Enquiry's vendor; Consultation-sourced quotes start from
its service list. Draft saves recompute totals server-side.

### 6.2 Send
`DRAFT → SENT` inside a transaction: validate (≥ 1 item, totals coherent, `validUntil` in the future), freeze, set
`sentAt`, log `QUOTATION_SENT` on the source entity, supersede the previous revision if any. The UI then offers a
**prepared WhatsApp message** (copy) and a printable page. V1 does not send anything itself.

### 6.3 Accept / reject (decided — §11 Q1: staff-recorded in V1)
V1 records acceptance **on behalf of the customer**: staff choose channel (WhatsApp / phone / in person / other), an
optional note, and the system stores `acceptedAt`, `acceptedById`, `acceptedChannel`. The customer has no login at quote
stage, so this mirrors how the sale really happens. **No customer login and no customer accept link in V1** (explicit decision). The data model leaves room for a tokenized link
later (an optional token column), nothing more.

### 6.4 Create Booking from an accepted quotation
Action available only on `ACCEPTED`. Creates a `Booking` (`NEW`) with `quotationId` (unique → a second attempt fails
cleanly), the source's `enquiryId`/`consultationId`, contact/city/date/guest data from the source, and `BookingItem`s
copied from the quote lines (`price = unitPrice`, `quantity`, `vendorId`). **Prices come from the quote, not from
`VendorPackage`** — this is the negotiated price, unlike the marketplace cart path in `bookingService.create`.
`Booking.total = quotation.total` (discount/tax live on the quote, linked). Confirming the booking uses the existing
`PUT /api/bookings/[id]` → `convertBookingToWedding`.

### 6.5 Pipeline coupling (CRM)
Sending a quote advances the source to `QUOTATION_SENT` **only when `canTransition(current, QUOTATION_SENT)` is true**;
otherwise the quote still sends and the UI tells the coordinator which stage step is missing. The state machine is never
bypassed. **Decided (§11 Q2): `QUOTATION_SENT → WON` is allowed when an accepted quotation exists.** The rule is enforced **on the
server**: the pure map in `lib/crm/pipeline.ts` gains a context-aware check, and `leadWorkspaceService` refuses the
transition unless the source has an `ACCEPTED` quotation (read from the database at transition time). The frontend can
never change the stage on its own; without an accepted quote the old rule (`→ NEGOTIATION → WON`) still applies.

### 6.6 Automatic advance invoice — inside conversion
One helper, `ensureAdvanceInvoice(tx, wedding, quotation)`, called from **both** conversion paths, after the Wedding and
its events exist, **inside the existing transaction and advisory lock**:

- **Booking path** (`convertBookingToWedding`): quotation = `booking.quotationId`.
- **CRM path** (`convertLeadToWedding`): the source's `ACCEPTED` quotation, if any.

Rules:
1. `advanceAmount = 0` → do nothing.
2. `quotation.advanceInvoiceId` already set → do nothing (**idempotent**; `advanceInvoiceId` is `@unique`).
3. Otherwise create one `Invoice` in `DRAFT`: client name/phone/city from the booking or source, `eventDate`/`eventType`
   from the wedding, **one line** "Advance — QTN-…" for `advanceAmount`, `discount = 0`, **`gstEnabled = false`,
   `gstAmount = 0`** (**decided — §11 Q4: no tax in V1**; nothing about GST is invented, revisit after accounting/CA confirmation), `notes` referencing the quote and its total, linked
   to the Wedding; store its id in `quotation.advanceInvoiceId`; log `INVOICE_CREATED` on the wedding.
4. **The Razorpay payment link is not created here.** It is an external call that must not run inside a database
   transaction; staff use the existing "Create payment link" action on the invoice. The balance invoice stays manual.

```
Enquiry/Consultation ──create──▶ Quotation DRAFT ──send──▶ SENT ──accept──▶ ACCEPTED
                                                                              │ create booking
                                                                              ▼
                                                                    Booking NEW ──confirm──▶ CONFIRMED
                                                                              │ convertBookingToWedding (tx + lock)
                                                                              ▼
                              Wedding + events + vendor bookings + tasks + **advance Invoice (DRAFT)**
                                                                              │ staff: Create payment link (manual)
                                                                              ▼
                                                                      Razorpay webhook → Payment
```

## 7. Required changes to existing code (each with a test)

| # | Change | Why (evidence) |
|---|---|---|
| 1 | `agreedPrice` in conversion must be `price × quantity` | `weddingConversion.service.ts` sets `agreedPrice: item.price` and ignores `quantity`; a quote line "500 plates × ₹800" would create a ₹800 vendor booking. Cart items were effectively quantity 1, so it never showed. |
| 2 | Make `generateInvoiceNumber` (and the new `generateQuotationNumber`) race-safe | Both are count-then-insert (`INV-YYYYMM-NNNN`). With the advance invoice inside the conversion transaction, two different weddings converting at once can collide on the unique `invoiceNumber` and **fail a conversion**. Serialize per bucket with `pg_advisory_xact_lock`. Also fixes the known `generateWeddingNumber` race (P2). |
| 3 | Wording for vendor-less lines in conversion | A quote line with `vendorId = null` reuses the existing "skip + task" path, but the log says "vendor no longer exists". Change to "Assign a vendor for …" for custom lines. |
| 4 | `Booking.quotationId`, new `ActivityType` values, `SUPERSEDED` | Schema (§4). |
| 5 | Allow `QUOTATION_SENT → WON` **only when the server finds an `ACCEPTED` quotation for the source** (decided, §11 Q2) | Removes a meaningless `NEGOTIATION` hop for an already-accepted deal without loosening the state machine. |

## 8. API (all `requireRole(ADMIN_ROLES)`; Zod schemas; `handleApiError`)

| Method & path | Purpose |
|---|---|
| `GET /api/quotations?enquiryId|consultationId|leadId=` | list for a source |
| `POST /api/quotations` | create DRAFT (exactly one source id) |
| `GET /api/quotations/[id]` | detail with items and computed balance |
| `PATCH /api/quotations/[id]` | edit a DRAFT only |
| `POST /api/quotations/[id]/send` · `/revise` · `/accept` · `/reject` | transitions |
| `POST /api/quotations/[id]/create-booking` | from `ACCEPTED` only |

Invalid transitions return **409** (note: `InvalidTransitionError` currently maps to 400 — audit §7; fix alongside).
Responses keep the `{ success, data | error }` shape; validation errors return field-level `issues`.

## 9. UI (human language, one primary action per screen)

- Enquiry/Consultation card: **Create quote** / **Open quote** with a status chip (Draft · Sent · Accepted · Expired).
- Quote editor: lines table → summary strip **Total · Advance · Balance** → **Valid until** → primary button **Send**
  (Draft) / **Mark accepted** / **Create booking** (Accepted).
- After conversion, the Wedding Workspace Finance panel shows the advance invoice with the existing **Create payment
  link** action. Terms shown: *Quote, Advance, Balance, Valid until* — never `QuotationStatus`/`advanceInvoiceId`.
- Mobile: single column, sticky summary strip.

## 10. Security

Staff-only V1 (`ADMIN_ROLES`; role split is open decision #4). Quotes contain pricing, so no public route exists until
the token link (later) — which will use an unguessable token, read-only view, rate limit, and expiry. Every mutation
writes `ActivityLog` (who/what/when/from→to).

## 11. Decisions (confirmed 20 Sep 2026)

| # | Question | Decision |
|---|---|---|
| Q1 | Who records acceptance in V1? | **Staff record it** on the customer's behalf (WhatsApp / phone / in person). **No customer login or accept link at this stage.** |
| Q2 | Allow `QUOTATION_SENT → WON` when an `ACCEPTED` quote exists? | **Yes**, verified **server-side** (the server checks for an accepted quotation; the frontend alone can never move the state). |
| Q3 | Advance entered as fixed ₹ or %? | *Not asked; proceeding on the recommendation:* store the ₹ amount; the editor may accept a % and convert it. Change on request. |
| Q4 | Tax on the automatic advance invoice | **No tax in V1** — `gstEnabled = false`, `gstAmount = 0`. No GST/tax rule is invented; revisit after accounting/CA confirmation. |
| Q5 | Quotes from Leads? | *Not asked; proceeding on the recommendation:* allowed by the API, not surfaced in the V1 UI. |

Standing rules carried over from the audit: fix the booking → wedding `agreedPrice` to respect quantity (§7 #1); make
invoice numbering race-safe **before** the advance invoice is created transactionally (§7 #2); **payment-link creation
stays outside the database transaction**; **no parallel approval structure** — `ApprovalRequest` cannot support
quote-stage acceptance (it requires a Wedding), so acceptance lives on the Quotation; **no manual database repair**
(tracked migrations only: schema → migration → staging → tests → production).

## 12. Tests

- **Unit:** `calculateQuotationTotals` (rounding-free integer math, discount bounds, advance bounds, large values);
  transition table (every legal/illegal pair); number formatting.
- **Service (mocked repos, existing pattern):** create/edit/send/revise/accept/reject; edit-after-send rejected; second
  open quote rejected; expiry evaluated on accept; revise supersedes; `create-booking` only from `ACCEPTED`;
  `ensureAdvanceInvoice` (zero advance → none; existing id → none; correct invoice fields; both conversion paths).
- **Route:** auth (401/403), schema errors return `issues`, 409 on invalid transition.
- **Concurrency (needs the real-DB harness, P0-6):** two simultaneous `accept`, two `create-booking` for one quote, two
  conversions of one booking → exactly one advance invoice, and two different weddings converting at once never collide
  on invoice numbers.
- **Golden test:** steps *Create Quotation → Approve → Create Booking → Confirm → Create Wedding → advance Invoice exists →
  Record/verify payment* (payment after the wedding, per decision #3).

## 13. Build order (each slice is DB + API + UI + tests + docs, per the vertical-slice rule)

| Slice | Content | Size (rough) |
|---|---|---|
| S1 | Migration (model, items, CHECK, partial unique indexes), totals function, race-safe numbering, create/edit/list service + API + minimal editor, tests | M |
| S2 | Send / revise / accept / reject / expiry, activity logging, status chips, prepared WhatsApp message, **server-verified `QUOTATION_SENT → WON`** | M |
| S3 | `Booking.quotationId`, create-booking-from-quote, `agreedPrice × quantity` fix, vendor-less line wording | S |
| S4 | `ensureAdvanceInvoice` in both conversions, invoice-number lock, Finance panel shows it, tests | M |
| S5 | Real-DB concurrency tests + Golden test steps, docs (`ROLE_PERMISSION_GUIDE` entry, testing guide) | M |

S1–S4 do not depend on the real-DB harness; S5 does (audit P0-6). Nothing here changes production data until a tracked
migration is applied through the normal path (schema → migration → staging → tests → production).
