# Wedding Workspace — Functional Design

If the CRM (`02-crm.md`) helps win weddings, this is what delivers them. This is the
concrete realization of the "Wedding Command Center" concept from the original
product vision — a single-screen view of everything about one wedding — now fully
specified rather than a one-paragraph idea.

## Philosophy

A wedding is not a booking row. It's a project: a couple, families, multiple events,
multiple vendors, a budget, tasks, documents, a timeline, and a communication
history — all belonging to one `Wedding` record (the aggregate root established as
the core architectural principle back in Part 1, and the reason Phase A's schema
reserved `customerId` on every lead-shaped table without yet building the entity
itself).

**Design constraint that governs every section below:** if someone opens a wedding
for the first time today, they should understand everything they need to know
within 60 seconds. Every section here exists to make that true — not to display
data for its own sake.

## 1. Overview

The landing view. Shows: wedding status, countdown to wedding day, budget summary
(planned/confirmed/paid/outstanding — full detail in §6), completion percentage
(derived from Task Board, §8), outstanding tasks, outstanding payments, assigned
coordinator, and the Wedding Health Score (§10).

**Data source:** `Wedding` (status, weddingDate) + aggregates from every other
section on this page. This is genuinely a rollup screen, not its own data — it's
the one place all the other sections' summaries surface together, which is exactly
what makes the 60-second principle achievable.

## 2. Couple Profile

Bride, Groom (as two named contacts, not one — see gap below), contact numbers,
family contacts, wedding city, guest count, preferred language, preferences.

**Gap:** every current capture entity (`Lead`, `Enquiry`, `Consultation`) has a
single `name`/`phone` pair — there's no bride/groom distinction, no family contact
list, no language preference anywhere in Phase A's schema. When a lead converts to a
`Wedding` (§ per `02-crm.md`), this is genuinely new data to be collected, not
data that transfers over automatically from the CRM record.

## 3. Wedding Timeline

Not a flat checklist — an ordered sequence of milestones, each with an owner, a due
date, a status, and dependencies on earlier milestones (e.g. "Invitation Sent"
can't be marked done before "Guest List Finalized" exists).

Example sequence: Lead Won → Consultation Complete → Venue Booked → Photography
Booked → Decoration Finalized → Catering Confirmed → Invitation Sent → Guest RSVPs →
Final Payment → Wedding Day → Post-event Review.

**Design note:** the exact milestone sequence above is a reasonable default, not a
fixed schema — different weddings (a 2-day vs. 5-event wedding) need different
milestones. The underlying entity should support a customizable/templated milestone
list per wedding, not a hardcoded 11-step pipeline.

## 4. Event Management

**Structural decision this section forces, and the most important one in this
document:** a `Wedding` is not single-date. One wedding has multiple events
(Engagement, Mehendi, Haldi, Sangeet, Wedding, Reception), each with its own date,
time, venue, vendors, budget, and checklist.

This means vendor bookings (§5) need to reference a specific event within the
wedding, not just the wedding as a whole — a photographer booked for the Sangeet and
a different one for the Wedding day are two separate bookings, not one. **Proposed
entity: `WeddingEvent`** (child of `Wedding`), with `VendorBooking` (§5's gap)
referencing `WeddingEvent`, not `Wedding` directly. Getting this relationship right
now matters — modeling `VendorBooking` against `Wedding` instead of `WeddingEvent`
would make multi-event weddings unrepresentable without a rework later.

## 5. Vendor Assignment

Per service (Venue, Photographer, Decorator, Makeup, Catering, DJ, Pandit,
Transportation, and any other category): assigned vendor, booking status,
availability, contact, payment status.

**Builds on real, already-migrated data**: vendor selection pulls from the existing
`Vendor` + `VendorPackage` models (Milestone 2 already has a working repository for
both). **The new piece is a join entity** — proposed `VendorBooking` — connecting
`WeddingEvent` + `Vendor` (+ optionally a specific `VendorPackage`) + status + agreed
price + payment status. This is the concrete entity the original CRM vision named in
the abstract ("Wedding → Services → Vendor Bookings → Payments/Tasks") — this
section is where it actually gets specified. Availability display depends on the
`VendorAvailability` gap already flagged in `01-command-center.md`.

## 6. Budget Tracker

Planned budget, confirmed spend, paid, outstanding, variance — shown both as a
wedding-level total and broken down per service.

**Data source, once the gaps above exist:** planned = a budget field on `Wedding`
(seeded from `Consultation.totalBudget` at conversion, editable after); confirmed
spend = sum of `VendorBooking.price` across all events; paid = sum of payments
against those bookings (needs a `Payment`/`PaymentSchedule` entity — named in the
original vision, not yet modeled); outstanding = confirmed − paid; variance =
planned − confirmed. **Note the overlap with `06-finance.md`** (not yet written):
this section owns the *per-wedding* view; the Finance doc will own company-wide
mechanics (GST, commission, payout timing) built on the same underlying `Payment`
entity.

## 7. Documents

Centralized storage for contracts, quotations, invoices, IDs, venue agreements,
floor plans, menus, and payment receipts.

**Reuses existing infrastructure, doesn't introduce new:** Cloudinary is already the
storage decision for this whole migration (explicitly kept as-is, see
`docs/postgres-migration-plan.md`) — a `Document` entity here is just metadata
(type, category, uploaded-by, linked-to) pointing at a Cloudinary URL, following the
exact upload pattern already built for vendor images. Documents should link to
either the `Wedding` directly (contracts, IDs) or a specific `VendorBooking`
(quotations, invoices, receipts tied to one vendor).

## 8. Task Board

Every task: owner, priority, due date, status, related event, related vendor.

**Reconciliation with the CRM doc, not a separate entity:** `02-crm.md` §7 already
flagged a `FollowUp`/`Task` gap for sales follow-ups. Rather than build two
unrelated task systems (one for sales, one for execution), **propose one `Task`
entity with a `context` discriminator** (`SALES_FOLLOWUP` vs. `WEDDING_TASK`),
sharing the same owner/due-date/status/priority shape. The Command Center's
Sales Dashboard ("Follow-ups Due Today") and Operations Dashboard ("Timeline
Progress," "Team Assignments") both end up querying the same table, filtered
differently — simpler than maintaining parallel systems.

## 9. Communication

Chronological timeline of every interaction: calls, WhatsApp messages, emails,
notes, meetings.

**Same reconciliation logic as Task Board:** `02-crm.md` §4 already specified that
every sales follow-up attempt gets logged (who, when, channel, outcome). **Propose
one shared `ActivityLog`/`Communication` entity spanning the full lifecycle** —
pre-conversion sales activity and post-conversion execution communication are the
same kind of record (who talked to whom, when, about what), just at different
pipeline stages. One timeline, not two, is also what makes the 60-second Overview
principle achievable — a coordinator shouldn't need to check a separate CRM log to
see how a lead was originally won.

## 10. Wedding Health Score

A computed (not stored) score per wedding: 🟢 On Track / 🟡 Needs Attention / 🔴 At
Risk, derived from task completion rate, vendor confirmation rate, payment status,
timeline adherence, and open issue count.

**Proposed v1: deterministic and rules-based**, not AI — a weighted combination of
the five inputs above, computed on read (or cached and recomputed on a schedule if
that proves too slow at scale). This matches the same pattern already set in
`02-crm.md` for lead-priority scoring: ship a simple, explainable formula first,
let `07-ai-assistant.md` (not yet written) propose a smarter version later once
there's real data to validate it against. A score nobody can explain is worse than
no score.

---

## Data model gaps

Everything below is new relative to Phase A's schema. Where a gap was already named
in an earlier doc, it's marked so this list doesn't fork into contradictory
definitions across docs.

| Concept | First named in | Detail here |
|---|---|---|
| `Wedding` | `01-command-center.md`, original vision | Confirmed again as the aggregate root — status, weddingDate, budget, coordinator assignment |
| `WeddingEvent` | **New, this doc** | Child of `Wedding` — one wedding, many dated/venued events (Mehendi, Sangeet, Wedding day, etc.) |
| `VendorBooking` | Named in the abstract by the original vision, concretized here | Joins `WeddingEvent` + `Vendor` (+`VendorPackage`) + status + price + payment status — the entity `VendorAvailability` conflicts get checked against |
| `VendorAvailability` | `01-command-center.md` | Unchanged — still the same gap, now with a concrete consumer (`VendorBooking` conflict checks) |
| `Task` (unified) | `02-crm.md` named `FollowUp`/`Task` for sales | **Reconciled here**: one entity, `context` discriminator (`SALES_FOLLOWUP` / `WEDDING_TASK`), not two parallel systems |
| `ActivityLog`/`Communication` (unified) | `02-crm.md` implied a follow-up log | **Reconciled here**: one timeline spanning pre- and post-conversion |
| `Payment`/`PaymentSchedule` | Named in the abstract by the original vision | Backs Budget Tracker's "paid"/"outstanding"; will also back `06-finance.md`'s company-wide mechanics |
| `Document` | **New, this doc** | Metadata only — points at Cloudinary URLs using the existing upload pattern, no new storage system |
| Couple Profile fields (bride/groom, family contacts, language) | **New, this doc** | Genuinely new data collected at conversion, not present in any Phase A capture entity |
| Milestone/Timeline entity with dependencies | **New, this doc** | Needs to support a customizable sequence per wedding, not a hardcoded 11 steps |

## Relationship to other modules

- **From `02-crm.md`**: a `WON` lead converts into a `Wedding` — this doc is that
  handoff's destination.
- **To `01-command-center.md`**: Operations Dashboard's "Today's Events" and
  "Timeline Progress" widgets are powered by `WeddingEvent` and the Wedding
  Timeline (§3) respectively; Founder Dashboard's cross-category Vendor
  Availability widget is powered by the same `VendorBooking`/`VendorAvailability`
  data as §5 here.
- **To `04-vendor-os.md`** (not yet written): §5's vendor-assignment view is the
  *wedding's* view of a `VendorBooking`; Vendor OS will be the *vendor's* view of
  the same underlying data (their calendar across all weddings, not one wedding's
  vendor list).
- **To `06-finance.md`** (not yet written): §6's Budget Tracker is the per-wedding
  view of `Payment`; Finance owns the company-wide GST/commission/payout mechanics
  built on the same entity.
- **To `07-ai-assistant.md`** (not yet written): both the Wedding Health Score
  (§10) and lead-priority scoring (`02-crm.md`) are specified as rules-based v1
  systems this doc will eventually upgrade.

## Future enhancements

- Guest list management + RSVP tracking (not specified here — large enough to be
  its own future doc if it grows beyond a Couple Profile field)
- Automated milestone-dependency suggestions based on wedding date proximity
- Wedding Health Score explanations ("why is this 🟡") surfaced inline, not just the
  color
