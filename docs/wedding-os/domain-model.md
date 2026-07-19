# Domain Model — Wedding OS

Step 1 of Phase B: business language only, no SQL, no Prisma. Every entity below is
compiled from what the 7 functional-design docs (`01`–`07`) actually needed, not
invented fresh — this doc is a synthesis, not a new design pass. Step 3 (the
physical Prisma schema) is deliberately a separate, later doc — this one exists so
database design doesn't drive the product, per the reasoning for doing it this way.

## 1. Entities (business language)

### Marketplace context
`Category` · `Vendor` · `VendorPackage` · `VendorFaq` · `VendorApplication` · `Blog`
— all real, already migrated in Phase A. No changes needed from the Wedding OS docs.

### CRM context
`Lead` · `Enquiry` · `Consultation` (all real, Phase A) · `PipelineStage` ·
`Quotation` — the last two are new, from `02-crm.md`.

### Wedding context (the aggregate — see §3)
`Wedding` · `Couple` · `WeddingEvent` · `VendorBooking` · `TimelineMilestone` ·
`Document` — all new, from `03-wedding-workspace.md`.

### Finance context
`Invoice` · `InvoiceItem` (real, Phase A, GST-aware) · `Payment` · `PayoutBatch` ·
`CommissionRate` — new, from `06-finance.md`. `Payout`/`Commission` records live
here (money-ledger entities), even though Vendor OS is where they're *displayed*.

### Vendor OS context
`VendorAvailability` · `Review` · `VendorPaymentDetails` — new, from
`04-vendor-os.md`. `VendorPaymentDetails` is proposed as its own entity rather than
fields on `Vendor` (see §4) — sensitive data benefits from isolation, not just a flag.

### Identity context
`User` (real, Phase A: `SUPER_ADMIN`/`SALES`/`VENDOR`/`CUSTOMER`, plus the still-open
"Operations" role question from `01-command-center.md`) · `Otp` (real, Phase A).

### AI context
`AIConversation` — new. (`AI Suggestions`/`AI Tasks`, as named in your bounded-context
sketch, are **not** separate entities here — see §4, they're unified into the
cross-context `ApprovalRequest` entity instead.)

### Shared / cross-context (belongs to no single bounded context)
`Task` · `ActivityLog` · `ApprovalRequest` — all three are referenced by multiple
contexts by design (see §4 for why each is unified rather than duplicated per context).

## 2. Relationships

```
Wedding
├── Couple                 (1:1)
├── WeddingEvent            (1:many)
│     └── VendorBooking     (1:many — booking is scoped to an event, not the wedding as a whole)
├── TimelineMilestone       (1:many)
├── Task                    (1:many, context=WEDDING_TASK)
├── ActivityLog             (1:many)
├── Document                (1:many)
├── Invoice                 (1:many)
│     └── Payment           (1:many)
└── Budget                  (COMPUTED — not a stored entity, derived from
                              VendorBooking.price + Payment, per 03-wedding-workspace §6)

Lead / Enquiry / Consultation  --[WON]-->        Wedding
Booking                        --[CONFIRMED]-->  Wedding
    (CRM context / Marketplace-adjacent          (Wedding context — TWO conversion
     self-service checkout)                       paths into the same aggregate root,
                                                    resolved 2026-07-19 — see §5)

VendorBooking --> Vendor          (Wedding context references Marketplace context)
Task.assignedToUserId --> User    (Wedding/CRM context references Identity context)
Wedding.customerId --> User       (0 or 1 — a Wedding may exist before any login account does)
ApprovalRequest.subject --> {VendorBooking | VendorProfile | AIConversation-draft}
                                   (one workflow entity, three subject types)
```

## 3. The Wedding Aggregate

`Wedding` is the aggregate root — confirmed, not newly decided, by every doc in
this set assuming it. Everything under it (`Couple`, `WeddingEvent`,
`VendorBooking`, `TimelineMilestone`, `Task`, `ActivityLog`, `Document`, `Invoice`/
`Payment`, and the computed `Budget`) is reachable from one `Wedding` record. Almost
every other module in the system (Command Center, Vendor OS, Customer Portal,
Finance reporting) is a *view* into this aggregate, scoped and filtered differently
per role — not a separate data model.

**Validation exercise, as requested — can every `03-wedding-workspace.md` screen be
built from this aggregate?**

| Wedding Workspace section | Built from |
|---|---|
| Overview | `Wedding` + rollups from every child below |
| Couple Profile | `Couple` |
| Wedding Timeline | `TimelineMilestone` |
| Event Management | `WeddingEvent` |
| Vendor Assignment | `VendorBooking` (+ `Vendor`, cross-context reference) |
| Budget Tracker | Computed from `VendorBooking.price` + `Payment` |
| Documents | `Document` |
| Task Board | `Task` |
| Communication | `ActivityLog` |
| Wedding Health Score | Computed from `Task` + `VendorBooking` + `Payment` + `TimelineMilestone` |

All 10 validate. No section needs an entity outside this aggregate (plus the two
cross-context references noted).

## 4. Consolidation decisions (deviations from a literal reading of each doc, explained)

Three previously-separate-sounding concepts are unified here into shared entities,
each already reasoned toward in the individual docs but not stated this plainly
until compiling them together:

- **`Task`** — one entity, `context` discriminator (`SALES_FOLLOWUP` /
  `WEDDING_TASK`), per `03-wedding-workspace.md` §8's own reconciliation. Confirmed
  here as the domain-model source of truth.
- **`ActivityLog`** — one entity spanning pre- and post-conversion communication,
  per `03-wedding-workspace.md` §9. **New in this pass**: "Notes" (listed as a
  separate concept in early sketches) is modeled as an `ActivityLog` entry *type*
  (`NOTE`, alongside `CALL`/`WHATSAPP`/`EMAIL`/`MEETING`), not a fourth table — a
  pinned/non-chronological note is still fundamentally "something recorded about
  this wedding at a point in time," the same shape as every other entry.
- **`ApprovalRequest` — new, unifies three previously-separate approval flows**
  that would otherwise be three near-identical ad-hoc mechanisms: vendor
  profile-change approval (`04-vendor-os.md` §2), AI Level-2 draft approval
  (`07-ai-assistant.md` §5), and customer approval of a proposed vendor
  (`05-customer-portal.md` §3, if that UX direction is chosen). One entity —
  subject type, subject id, requested by, status, approved by, approved at — with
  three possible subject types, instead of three tables that would drift from each
  other over time.

Two mappings, not new entities:
- **`TeamMember`** (from your Core list) — maps to `User` filtered to internal
  roles (`SUPER_ADMIN`/`SALES`/Operations), not a separate table.
- **`Customer` vs. `Couple`** — kept distinct on purpose. `User` (role=`CUSTOMER`)
  is the *login account*; `Couple` is the *relationship record* (bride/groom names,
  family contacts) attached to a `Wedding`. A `Wedding` can have a `Couple` before
  any login account exists (a coordinator entered the details) — hence
  `Wedding.customerId → User` is 0-or-1, not required.

## 5. Resolved: `Booking` also converts into a `Wedding` (decided 2026-07-19)

Two live paths now both terminate at the same aggregate root: the coordinator-led
CRM path (`Lead`/`Enquiry`/`Consultation` → qualified → `WON` → `Wedding`, per
`02-crm.md`) and self-service cart checkout (`Booking` → `CONFIRMED` → `Wedding`).
Decision: **`Booking` also converts, it doesn't stay a permanently separate,
simpler concept.**

**Mechanics:**
- **Trigger:** `Booking.status` reaching `CONFIRMED` (the existing Phase A enum
  value — chosen over `CLOSED`, which reads more like post-event archival than
  "this is now real, start executing it"). Not immediate on cart submission, same
  reasoning as CRM's `WON` gate — a raw checkout still benefits from a
  confirmation step before becoming a full `Wedding` record.
- **Field mapping:** `Booking.items[]` (each already `vendorId` + `packageName` +
  `price` + `quantity`) maps directly onto `VendorBooking` records — this is a
  clean, near-1:1 translation, not a re-modeling. `Booking.city` seeds the primary
  `WeddingEvent`'s city.
- **Linkage:** `Booking` already reserved a nullable `customerId` field in Phase A
  (`docs/postgres-migration-plan.md`, "every lead-shaped table," anticipating
  exactly this) — that field is what actually gets populated on conversion.
  Naming (`customerId` vs. something like `weddingId`) is a Step 3 detail, not a
  new gap.

**New, smaller gap this resolution surfaces:** `Booking` has **no wedding-date
field today** — checked directly against the live Phase A schema, not assumed.
Converting to a `Wedding`/`WeddingEvent` needs a date, and cart checkout currently
never asks for one. Two ways to close this, **a product/UX decision, not resolved
here**: (a) add a date field to the self-service checkout flow itself, or (b)
collect it during the coordinator's confirmation step (§ trigger above) before
conversion — i.e. `CONFIRMED` requires a date to be set, checkout itself stays as
simple as it is today.

## 6. Bounded contexts (summary)

| Context | Owns |
|---|---|
| Marketplace | Category, Vendor, VendorPackage, VendorFaq, VendorApplication, Blog |
| CRM | Lead, Enquiry, Consultation, PipelineStage, Quotation |
| Wedding | Wedding, Couple, WeddingEvent, VendorBooking, TimelineMilestone, Document |
| Finance | Invoice, InvoiceItem, Payment, PayoutBatch, CommissionRate |
| Vendor OS | VendorAvailability, Review, VendorPaymentDetails |
| Identity | User, Otp |
| AI | AIConversation |
| *Shared (no single context)* | Task, ActivityLog, ApprovalRequest |

## 7. Next step

**Step 3 — physical Prisma schema** — is the next doc, not this one. It should
trace every table back to an entity named here, extending
`docs/postgres-migration-plan.md`'s already-migrated Phase A schema rather than
replacing it. §5's `Booking` question is resolved; the one remaining open item
before Step 3 is the smaller product/UX decision on where a `Booking`'s wedding
date gets collected (§5).
