# Step 4: Workflow-by-Workflow Schema Review

Reviewing Draft 1 (`prisma/schema.prisma`) against the 6 workflows named for this
review, tracing each step against actual fields/relations rather than re-stating
the notes doc. Distinguishing two kinds of finding throughout: a **schema gap**
(a field/relation/table genuinely missing) vs. an **implementation question**
(the schema supports it, but *when*/*how* the app populates it isn't decided) —
only the first kind should change `prisma/schema.prisma`.

## Workflow 1: Customer books venue → Wedding

`Booking → CONFIRMED → Wedding → WeddingEvent → VendorBooking → Tasks → Payments →
Timeline → Activity → AI notified`

| Step | Traced against | Result |
|---|---|---|
| Booking created | `Booking` + `BookingItem[]` | ✅ |
| `CONFIRMED` | `BookingStatus` enum | ✅ existing |
| Wedding created | `Wedding.sourceBookingId`, `source=BOOKING`, `primaryDate=weddingDate`, `city` | ✅ |
| Event created | `WeddingEvent.weddingId` | ✅ |
| VendorBooking created | `BookingItem.vendorId` → `VendorBooking.vendorId` | 🔴 **Real schema gap, see below** |
| Tasks generated | `Task.weddingId`/`vendorBookingId` | ✅ (creation itself is app logic, not a schema concern) |
| Payments tracked | `Payment.invoiceId` requires an `Invoice` to exist first | ⚠️ Implementation question, not a schema gap — restated from Draft 1 notes, not new |
| Timeline updated | `TimelineMilestone.weddingId` | ✅ |
| Activity logged | `ActivityLog.weddingId` | ✅ |
| AI notified | `AiConversation`/`Notification`, both have `weddingId` | ✅ |

### 🔴 Real finding: `BookingItem.vendorId` is nullable, `VendorBooking.vendorId` is required

`BookingItem.vendorId String?` is nullable **by design** (Phase A, tolerates
historical bookings against vendors later removed — e.g. the "Touch Of Cozy" case
already documented in `docs/migration-readiness-report.md`). `VendorBooking.vendorId
String` is **required**, correctly, since its whole purpose is connecting a
`WeddingEvent` to a real, active vendor for delivery — loosening it to nullable
would defeat that purpose.

**This is a genuine gap in the conversion path**, not a business-logic question:
if a `Booking`'s `BookingItem` references a vendor that no longer exists (null
`vendorId`), conversion cannot mechanically create a `VendorBooking` for that item.

**Resolution — conversion logic, not a schema change**: when converting, skip any
`BookingItem` with a null `vendorId`, write an `ActivityLog` entry
(`STATUS_CHANGED`, summary noting the skipped item), and create a `WEDDING_TASK`
Task flagging it for manual resolution (coordinator assigns a replacement vendor).
The schema itself is correct as designed — `VendorBooking.vendorId` should stay
required — this is a conversion-logic detail to implement, documented here so it
isn't silently missed when Step 3.5/implementation happens.

## Workflow 2: Vendor onboarding

`VendorApplication → APPROVED → Vendor created (existing, live) → Vendor logs in`

Traced cleanly except one real question this raised, not previously surfaced:

### 🟡 Open question: can one person be both a Vendor and a Customer?

`User.phone String? @unique` — one phone number backs exactly one `User`, with
exactly one `Role`. A vendor who later wants to book their *own* wedding through
the platform (or a customer who becomes a vendor) can't cleanly get a second
account under the current model — the phone-number uniqueness blocks it.

**Not resolved here — flagging for your call**, same as every other open product
question in this doc set: is single-role-per-phone an acceptable v1 constraint
(edge case, low volume), or does the system need multi-role support per person? The
fix, if needed, is straightforward (a join table or an array-of-roles instead of a
single enum) but changes a core Identity-context assumption, so it shouldn't be
decided unilaterally.

## Workflow 3: Lead conversion

`Lead/Enquiry/Consultation → pipelineStage advances → WON → Wedding`

Traced cleanly. `Wedding.customerId` being nullable (0-or-1) is confirmed correct
here — a `Wedding` can exist before any login account does, exactly as
`domain-model.md` specified, not a gap.

**Secondary observation, not a blocking finding**: no de-duplication exists across
`Lead`/`Enquiry`/`Consultation` for the same real person (e.g. someone submits both
a `Lead` popup and a `Consultation`) — each stays independent. This was already an
intentional Phase A/CRM-doc decision (three separate capture tables), so not
re-litigated here, just noted as a real-world data-quality consideration for
whoever builds the Lead Inbox UI.

## Workflow 4: Wedding completion

Traced: `VendorBooking.status → COMPLETED` per booking, `onTimeService` flag set
post-event, `Review.weddingId` allows post-event reviews, `Wedding.status →
COMPLETED`.

### ✅ Fixed directly (small, uncontroversial): `Wedding.completedAt`

No dedicated timestamp existed for *when* a Wedding was marked complete —
`updatedAt` gets touched by any field edit, not specifically this transition,
which would make "average time from creation to completion" reporting unreliable.
Added `Wedding.completedAt DateTime?` directly (same pattern as
`VendorBooking.respondedAt`) rather than flagging — low-risk, clearly correct,
already applied to `prisma/schema.prisma` and re-validated (`prisma format`/
`generate` both still pass clean).

## Workflow 5: Refunds

Still explicitly out of scope, confirmed consistent with `06-finance.md`'s original
scoping decision — `PaymentStatus.REFUNDED` exists as a status value but no
refund-amount/reason/reversal tracking. Not a new gap; restating the existing
deferral, not re-opening it.

## Workflow 6: Finance reconciliation

Traced: `Payment.razorpayPaymentId` enables matching against Razorpay's own
records; `Payout.commissionRate` is a snapshot (not a live `CommissionRate`
reference) so historical payouts don't silently change if the rate config changes
later — confirmed this was implemented as designed, not just described.
`PayoutBatch` groups `Payout` records for batch reconciliation. No new gap —
commission-rate-variability and payout-timing remain open business decisions
already flagged in `06-finance.md`, not schema issues.

---

## Summary

- **1 real schema gap found and resolved as a conversion-logic decision** (not a
  schema change): `BookingItem.vendorId` nullable vs. `VendorBooking.vendorId`
  required — skip-and-flag during conversion.
- **1 small fix applied directly**: `Wedding.completedAt`.
- **1 open product question surfaced, needs your call**: single-role-per-phone
  (can someone be both Vendor and Customer?).
- **Everything else traced clean** across all 6 workflows — no further schema
  changes from this pass.

Schema re-validated after the `completedAt` addition: `prisma format` and
`prisma generate` both pass clean.
