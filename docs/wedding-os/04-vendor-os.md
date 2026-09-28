# Vendor OS — Functional Design

The deep specification of the Vendor Dashboard sketched at summary level in
`01-command-center.md` §4.4 — same relationship as `03-wedding-workspace.md` was to
the original one-paragraph "Wedding Command Center" idea. This module is the direct
implementation of the Vendor role as originally defined in Part 1: **"Manage
profile, Update prices, Block dates, Confirm bookings, View earnings."** Every
section below maps to one of those five verbs.

## 1. Purpose

Give vendors enough self-service control that Operations/Sales stop being a manual
relay between "customer wants X" and "is vendor Y available/willing/priced right."
Every vendor interaction currently requires an admin to touch the `Vendor` record on
their behalf (`/admin/vendors/[id]`) — this module replaces that with the vendor
managing their own profile, calendar, and pricing directly.

## 2. Vendor Profile Self-Service ("Manage profile")

Editable by the vendor directly: description, images/gallery, packages (§5),
address, map location, FAQs.

**Needs a moderation decision, flagged not resolved:** should every self-service
edit go live immediately, or do some changes (category change, business name
change) need admin review first? Minor edits (photo swaps, description tweaks)
going live immediately seems low-risk; category/name changes plausibly warrant
review given they affect how the vendor surfaces in public search. Propose: minor
fields self-service immediate, category/business-name changes create a pending
change for admin approval — same shape as the existing `VendorApplication` review
flow, reused rather than inventing a second approval mechanism.

## 3. Availability & Calendar ("Block dates")

The `VendorAvailability` entity (named as a gap in every prior doc in this set —
finalized here since this is its natural home) needs, per date: a state —
`AVAILABLE` / `TENTATIVE` / `BOOKED` / `BLOCKED` (vendor manually marked
unavailable, e.g. personal leave).

**How it interacts with bookings:** when a `VendorBooking` (from
`03-wedding-workspace.md` §5, joining a `WeddingEvent` to this `Vendor`) is
created against a date, that date's availability auto-transitions to `TENTATIVE`
(pending vendor confirmation, §4) and then `BOOKED` on confirmation. A vendor
manually blocking an already-`BOOKED` date should be prevented — surface the
conflict, don't silently overwrite a real booking. This conflict check is exactly
what powers the "vendor availability conflicts" alert already specified in
`01-command-center.md` §5.

**Calendar view** aggregates across every `WeddingEvent` the vendor is booked
against — a vendor works with many different weddings, so their calendar is the
union of all their `VendorBooking` dates plus manually blocked dates, not scoped to
one wedding. This is the same underlying data as Wedding Workspace §5's
vendor-assignment view and the Founder Dashboard's cross-category Vendor
Availability widget — three different views (vendor's own calendar, one wedding's
vendor list, business-wide availability summary) of one `VendorBooking`/
`VendorAvailability` dataset, not three separate data stores.

## 4. Booking Requests & Confirmation ("Confirm bookings")

When Operations/Sales creates a `VendorBooking`, it starts in
`PENDING_VENDOR_CONFIRMATION` — the vendor must actively accept or decline, not have
a booking silently assumed. Time from request-created to vendor-response is tracked
and directly feeds the "response time" component of the Vendor Score (§7) — this is
the actual mechanism behind that KPI, not a separate measurement.

Decline should require a reason (date conflict, price disagreement, etc.) — useful
both for the requesting coordinator (do they need to find a replacement vendor
immediately) and for the vendor's own cancellation-rate tracking in §7.

## 5. Package Management ("Update prices")

**Already real, already migrated:** `VendorPackage` exists in the Phase A schema
and has a working repository (`repositories/vendor.repository.ts`, Milestone 2) —
this section is almost entirely UI/permissions work, not new data modeling. Vendor
gets full CRUD on their own packages (name, description, price, features,
`isPopular`, `isPerPlate`, image) scoped to `vendorId = self`, same
`findMany`/`create`/`update`/`delete` interface every other repository in this
codebase already follows.

## 6. Earnings & Payouts ("View earnings")

Needs a `Payout`/`Commission` entity (named as a gap in `01-command-center.md` and
`03-wedding-workspace.md`, specified here). Per `VendorBooking`: agreed price,
platform commission (percentage — **rate itself is a business decision, not a
technical one, flag for the founder rather than assume a number**), net vendor
payout, payout status (pending/processing/paid), payout date.

**Payment timing is also a business decision to flag, not assume:** does the vendor
get paid when the customer pays the deposit, when the event completes, or on some
fixed cycle (weekly/monthly)? This materially affects vendor trust and cash flow and
shouldn't be decided implicitly by whatever's easiest to build.

Vendor sees: total earned (lifetime/this month), pending payouts, payout history —
directly mirrors the Vendor Dashboard's Earnings widget in `01-command-center.md`
§4.4, now with the underlying entity actually specified.

## 7. Reviews & Vendor Score

**Reviews:** needs an individual `Review` entity (currently `Vendor.rating`/
`reviewCount` are bare aggregate numbers with nothing behind them — flagged in
`01-command-center.md`). Once real `Review` records exist, `Vendor.rating`/
`reviewCount` should become **computed-on-read**, not stored/denormalized —
consistent with the pattern already established for `Category`'s vendor count in
Phase A (recomputed live via aggregation, not trusted as a stored field, per
`docs/postgres-migration-plan.md`). Same principle, same reason: a derived number
that can drift from its source is worse than recomputing it.

**Vendor Score** (named twice already — the original Part 1 vision and
`01-command-center.md`'s Founder Dashboard "Vendor Performance" widget — fully
specified here for the first time): a composite score from booking acceptance rate
(§4), average response time (§4), review rating (this section), cancellation rate
(§4's decline tracking), on-time service rate (needs a post-event
confirmation/flag, not yet modeled elsewhere — smallest new gap in this doc), and
repeat booking rate (same customer/coordinator booking the same vendor again).

**Proposed v1: deterministic weighted formula, same pattern as every other scoring
concept in this doc set** (CRM lead priority, Wedding Health Score) — ship
something explainable, let `07-ai-assistant.md` propose a smarter version once
there's real data. Used to power the Founder Dashboard's Vendor Performance ranking
and, eventually, "AI vendor recommendations" (named in the original Part 3 outline,
owned by the not-yet-written AI Assistant doc).

---

## 8. Proposal view ("See my accepted work") — built 29 Sep 2026 (PR #135)

Read-only view, behind vendor login, of the part of an **accepted** quotation that belongs to this vendor
(08-quotation.md §15 D4). Not a new model: a projection of the existing Quotation (`services/vendorProposal.service.ts`,
`lib/quotation/vendorProposal.ts`). Pages: `/vendor/proposals` (list, linked from the portal nav) and
`/vendor/proposals/[quotationId]`. No API route, no actions, no writes, no migration.

**ACCEPTED = vendor access begins. BOOKED = the accepted proposal has progressed to a booking; access continues.**
Visible when the quotation is `ACCEPTED` **and** has at least one line with this vendor — nothing else is checked. A
booking made from it only changes the label (*Accepted by the couple* → *Booked*); it is not a second requirement, and
later changes to the booking or the CRM record (e.g. booking closed, enquiry lost) do not remove access.

| Quotation | Vendor |
|---|---|
| DRAFT · SENT · SENT in negotiation · EXPIRED · REJECTED · SUPERSEDED | Hidden — one generic 404 |
| ACCEPTED, no booking | Visible — *Accepted by the couple* |
| ACCEPTED with a booking (any booking status) | Visible — *Booked* |

Another vendor's quotation or an unknown/malformed id is the same 404 — the page never reveals whether a quotation exists.

**Shown:** couple/wedding name, wedding date, guest count, city, event type · the vendor's own lines (category, function,
description, quantity, unit price, line total) · the agreed amount = the sum of those lines · once a wedding exists, date,
time and venue of only the functions this vendor is booked for (same rule as the existing portal).

**Never shown:** other vendors (names, ids, categories, lines, prices), quotation subtotal/total, discount, GST, advance,
balance, terms, inclusions/exclusions, internal notes, proposal link/token/hash, couple's view time, change requests,
acceptance channel/note/date/who, customer phone/email/id, CRM stage/owner/lost reason, lead/consultation/enquiry ids,
agreement snapshot, invoices, internal wedding number.

**Isolation (server-side):** the vendor is always the logged-in user's own vendor (`vendorForUser`), never an id from the
request · the database query only matches quotations with a line of that vendor and only selects that vendor's lines ·
the projection re-checks each line's vendor and outputs an explicit allow-list · `proxy.ts` admits only the VENDOR role
to `/vendor/*`, and each page checks it again.

**Amount:** the agreed amount for the vendor's quoted items (price × quantity), as quoted. Commission tiers are a
separate, later feature and are not applied here.

## Data model gaps

| Concept | First named in | Detail here |
|---|---|---|
| `VendorAvailability` | `01-command-center.md` | Finalized: `AVAILABLE`/`TENTATIVE`/`BOOKED`/`BLOCKED` states, auto-transitions from `VendorBooking` lifecycle |
| `VendorBooking` status flow | `03-wedding-workspace.md` | Adds `PENDING_VENDOR_CONFIRMATION` as the real starting status, with a required decline reason |
| `Payout`/`Commission` | `01-command-center.md`, `03-wedding-workspace.md` | Finalized shape here — commission %, payout status/date. **Commission rate and payout timing are open business decisions, not resolved by this doc** |
| `Review` (individual records) | `01-command-center.md` | Finalized: individual reviews, with `Vendor.rating`/`reviewCount` becoming computed-on-read (same pattern as `Category`'s vendor count) |
| On-time service flag | **New, this doc** | Smallest new gap — needed for Vendor Score's "on-time" component, not modeled anywhere else yet |
| Profile-change approval queue | **New, this doc** | Only for category/business-name changes — proposed to reuse the existing `VendorApplication` review mechanism rather than build a second one |

## Relationship to other modules

- **To `01-command-center.md`**: this doc is the full specification behind the
  Vendor Dashboard row (§4.4) and the Founder Dashboard's Vendor Performance widget.
- **To `03-wedding-workspace.md`**: shares the `VendorBooking`/`VendorAvailability`
  entities directly — Wedding Workspace §5 is the *wedding's* view, this doc is the
  *vendor's* view, of the same data.
- **To `06-finance.md`** (not yet written): `Payout`/`Commission` here is the
  vendor-facing half; Finance owns the company-wide reconciliation (GST, aggregate
  commission revenue, cash flow).
- **To `07-ai-assistant.md`** (not yet written): Vendor Score is specified here as
  rules-based v1, the AI Assistant doc's eventual upgrade target — same as CRM lead
  scoring and the Wedding Health Score.

## Future enhancements

- Vendor-side messaging/notifications when a new booking request arrives (push/WhatsApp)
- Bulk availability management (block a date range, not one date at a time)
- Vendor-facing analytics beyond earnings (which packages convert best, review trends)
