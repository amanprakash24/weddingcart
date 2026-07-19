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

Lead / Enquiry / Consultation  --[WON]-->  Wedding
    (CRM context)                          (Wedding context — the one cross-context
                                             event every other relationship in this
                                             system assumes already happened)

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

## 5. Open question this exercise surfaced (not resolved — flagging, per the pattern this whole doc set has followed)

**How does the existing `Booking` entity (Phase A, real — self-service cart
checkout with multi-vendor `items[]`) relate to `Wedding`?** Every Wedding OS doc so
far assumed the CRM path (`Lead`/`Enquiry`/`Consultation` → qualified → `WON` →
`Wedding`) as *the* way a `Wedding` gets created. But the live site also supports a
direct self-service cart checkout (`Booking`) that never goes through that pipeline.
Two live paths into what might need to become the same destination:

- Does a completed `Booking` also convert into a `Wedding` (self-service intake,
  parallel to the coordinator-led CRM intake)?
- Or does `Booking` stay a separate, simpler concept that never becomes a full
  `Wedding` (e.g. a single-vendor or low-touch purchase that doesn't need the full
  workspace)?

This wasn't visible until compiling the full domain model — worth a decision before
Step 3 (physical schema), since it changes whether `Booking` needs a `weddingId`
link or stays fully independent.

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
replacing it. The `Booking` question in §5 needs an answer before that doc is
written, not during it.
