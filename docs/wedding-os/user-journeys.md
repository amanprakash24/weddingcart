# User Journeys

Three end-to-end journeys through Shaadi Shopping OS, one per major role. Written
after the functional design set (`01`–`07`) and the domain model existed, so every
step below is grounded in a real entity or a real, already-flagged gap — not
invented alongside this doc. The point of writing these out explicitly: **every
role's journey is genuinely different**, which is the concrete evidence behind
`01-command-center.md`'s Role-Based Experience principle — that principle wasn't
asserted in the abstract, it falls out of actually tracing these three paths.

## Journey 1 — Customer

```
Google Search
     ↓
shaadishopping.com (Marketplace)
     ↓
Search / browse Venue (or any category)
     ↓
Submit Inquiry  — Enquiry, Consultation, or self-service Booking
     ↓                (02-crm.md §2: three separate capture entities, one pipeline)
CRM pipeline: NEW → CONTACTED → QUALIFIED → SITE_VISIT_SCHEDULED
     ↓          (02-crm.md §3 — Sales follow-up engine drives this)
QUOTATION_SENT → NEGOTIATION
     ↓
Venue Visit  (SITE_VISIT_SCHEDULED stage, logged as an ActivityLog entry)
     ↓
WON  — converts to a Wedding record (or Booking → CONFIRMED, the other path —
     ↓   domain-model.md §5: both paths terminate at the same aggregate root)
Wedding Workspace  (03-wedding-workspace.md — timeline, events, vendors, budget,
     ↓               documents, tasks, communication, health score)
Wedding Completed  (Wedding.completedAt)
     ↓
Review  — Vendor OS Review entity (04-vendor-os.md §7), gap, not yet modeled
     ↓
Referral  — not modeled anywhere yet, see gaps below
```

## Journey 2 — Venue Owner (Vendor)

```
Register  — VendorApplication (already exists, Phase A)
     ↓
Verification  — admin review of VendorApplication (already exists)
     ↓
Profile Setup  — VendorProfile (identity redesign, Milestone 4-adjacent)
     ↓
Upload Photos  — existing Cloudinary pattern, no change needed
     ↓
Add Packages  — VendorPackage (already exists, Milestone 2 repository built)
     ↓
Block Dates  — VendorAvailability (gap — the single most load-bearing gap
     ↓           named in 01-command-center.md §7 and 04-vendor-os.md)
Receive Inquiry  — Enquiry where vendorId = self (already exists)
     ↓
Accept Booking  — VendorBooking (04-vendor-os.md §4)
     ↓
Receive Payment  — Payout/Commission (gap, ties to 06-finance.md;
     ↓               commission rate & payout timing explicitly flagged there
     ↓               as an open business decision, not yet resolved)
Review  — Review entity (gap, 04-vendor-os.md §7)
```

## Journey 3 — Founder

```
Morning Dashboard  — 01-command-center.md §4.1
     ↓
Today's Follow-ups  — FollowUp/Task (gap, §4.2/§7)
     ↓
Call Customers  — logged as ActivityLog
     ↓
Assign Vendors  — VendorBooking, assignedToUserId (gap, §7)
     ↓
Confirm Bookings  — Booking.status → CONFIRMED, or CRM WON
     ↓
Collect Payments  — Invoice → Payment (06-finance.md)
     ↓
Monitor Revenue  — Founder Dashboard's Revenue Today/Month widget
     ↓
End of Day  — no report entity exists yet; closest existing concept is the
                AI Level-1 "Daily business summary" already named in
                07-ai-assistant.md §2 (Founder) — narrates existing widgets,
                doesn't require new data
```

## Why these three look nothing alike

The Customer journey is linear and one-shot (one wedding, then done — Review and
Referral are the only post-completion touchpoints). The Vendor journey is
cyclical (Receive Inquiry → Accept Booking → Receive Payment → Review repeats
per booking, indefinitely, for as long as the vendor is active). The Founder
journey is a daily loop, not a lifecycle at all. **A UI designed for one of these
shapes will always feel wrong for the other two** — this is the concrete reason
Role-Based Experience (`01-command-center.md`) isn't a cosmetic preference, it's
a structural requirement.

## Gaps this exercise surfaces

Two small, genuinely new items, on top of the (larger, already-tracked) gaps each
journey step references above:

| Gap | Journey | Notes |
|---|---|---|
| Referral tracking | Customer | Not modeled anywhere. Low priority until the CRM/Wedding pipeline itself is built — a referral is meaningless to track before there's a pipeline for it to feed into |
| End-of-day report | Founder | No dedicated entity — likely doesn't need one; probably a computed view over existing Founder Dashboard widgets (same "computed, not stored" pattern already used for `Vendor.rating`, `Category` vendor counts, `Invoice.amountPaid`), possibly the first concrete AI Level-1 feature to actually ship |

Neither blocks Milestone 5 — both are small, deferred, and don't require a schema
decision today.
