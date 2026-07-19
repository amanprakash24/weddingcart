# Phase B Schema — Draft 1 Notes

Step 3 of the domain-model → schema sequence. Extends `prisma/schema.prisma`
directly (branch `feat/wedding-os-schema`, off `feat/postgres-prisma-migration`) —
every new model traces back to `docs/wedding-os/domain-model.md`, organized into
the same bounded-context sections (Marketplace, CRM, Wedding OS, Finance, Vendor
OS, Identity, AI, Shared). `npx prisma format` and `npx prisma generate` both pass
clean against the full ~50-model schema.

## What's genuinely new vs. Phase A

Phase A models (`Vendor`, `Category`, `Lead`, `Enquiry`, `Consultation`, `Booking`,
`Invoice`, etc.) got **only additive fields and back-relations** — nothing removed
or renamed, per the explicit instruction not to force Wedding OS into the old
marketplace tables. Concretely: `Booking` gained `weddingDate`/`weddingType`/
`guestCount` (the resolved checkout decision) and a `wedding` back-relation;
`Lead`/`Enquiry`/`Consultation` each gained `pipelineStage`/`assignedToId`/
`lostReason` plus `tasks`/`activities`/`quotations`/`wedding` relations; `Invoice`
gained `weddingId`; `Role` gained `OPERATIONS`.

Everything else — `Wedding`, `Couple`, `WeddingEvent`, `VendorBooking`,
`TimelineMilestone`, `Document`, `Task`, `ActivityLog`, `ApprovalRequest`,
`Quotation`, `Payment`, `Payout`, `PayoutBatch`, `CommissionRate`,
`VendorAvailability`, `Review`, `VendorPaymentDetails`, `AiConversation`,
`Notification` — is new, greenfield, no Mongo lineage.

## Decisions made while writing this (not silently assumed)

- **`Role.OPERATIONS` added** as a real enum value, resolving the open question
  from `01-command-center.md` §2 — chosen over a permission-flag-on-`SALES`
  approach for consistency with how every other role is modeled. Flagged as a
  call worth confirming, not treated as uncontroversial.
- **"Store events, not state," implemented literally**: `Wedding`/`VendorBooking`/
  `Task` keep ordinary mutable status enums (for query simplicity), but
  `ActivityLog` is the append-only trail — deliberately has no `updatedAt`, and
  its `ActivityType` enum was extended with system-generated event types
  (`VENDOR_CONFIRMED`, `PAYMENT_RECEIVED`, `TASK_OVERDUE`, `TIMELINE_DELAYED`, …)
  alongside the human communication types already named in `03-wedding-workspace.md`.
  **This is a lighter state+event-log hybrid, not full event sourcing** — flagged
  explicitly as the chosen tradeoff, not the only option, since full event
  sourcing would be a much bigger architectural commitment than this doc set asked for.
- **`Booking` → `Wedding` conversion is now literally representable**:
  `Wedding.sourceBookingId`/`sourceLeadId`/`sourceEnquiryId`/`sourceConsultationId`
  are four nullable, individually-`@unique` FKs (exactly one set per Wedding,
  application-enforced) rather than one polymorphic reference — Postgres/Prisma
  don't have a clean polymorphic-FK primitive, and four explicit relations are
  more honest than a loosely-typed generic reference.
- **`VendorPaymentDetails` isolated from `Vendor`** into its own table, per
  `06-finance.md`'s sensitivity flag — bank/UPI details benefit from their own
  access boundary, not just a flag on the main record. Encryption-at-rest is
  still an application-layer TODO, noted inline in the schema — Prisma doesn't
  do this automatically.
- **`ApprovalRequest`, `Task`, and `ActivityLog` unify what would otherwise be
  parallel systems** — same reasoning as `domain-model.md` §4, now actually
  implemented as single tables with discriminator fields/subject types rather
  than three-per-concept tables.
- **`Notification` added**, not previously named as its own entity in any prior
  doc — surfaced because `01`/`04`/`07` all described alert/reminder/notify
  behaviors without a delivery mechanism behind them. Kept distinct from
  `ActivityLog`: the log records what happened, `Notification` is about
  alerting one specific user about it.
- **`Invoice.amountPaid` is untouched** — `06-finance.md` proposes it eventually
  become computed-on-read from `Payment` records, but that's an application-layer
  change for Step 3.5/implementation, not made here, since it would break
  Milestone 2's existing repository/service code for no reason at this stage.

## Self-check against your primary workflow (before calling this Draft 1)

`Customer books venue → Booking → CONFIRMED → Wedding created → Event created →
VendorBooking created → Tasks generated → Payments tracked → Timeline updated →
Activity logged → AI notified` — traced field-by-field against the schema:

Every step has a home **except one gap worth flagging**: nothing in the schema
*automatically* creates an `Invoice` when a `Wedding` is created from a `Booking` —
`Payment` requires an `invoiceId`, so "payments tracked" implicitly assumes an
`Invoice` already exists. The data shape supports it (`Invoice.weddingId` now
exists), but **when/how that Invoice gets generated is a business-logic question
for implementation, not a schema gap** — flagging so it isn't silently assumed to
already be handled.

Lead-conversion and vendor-onboarding workflows were also traced and validate
cleanly with no new gaps. Refund and finance-reconciliation workflows weren't
fully traced — refunds are explicit non-scope per `06-finance.md`, and
reconciliation is testable once real data exists, not meaningfully checkable
against an empty schema.

## Status

Draft 1 — schema written, formats and generates cleanly, self-checked against one
full workflow. **Not yet reviewed by you** — per your own Step 4 plan, the real
review is workflow-by-workflow, and that's still ahead, not done by this doc.
