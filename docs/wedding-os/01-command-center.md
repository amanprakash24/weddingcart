# Command Center — Functional Design

One system, four role-based views. Designed together (per the principle: every KPI
needs one clear owner, and designing roles in isolation leads to rework once the
others are defined), built incrementally: **Founder → Sales → Operations → Vendor**.

## Product Principle: Role-Based Experience (2026-07-21)

**Same platform, different experience per role.** This is a permanent design
principle, not a one-time UI decision — every future screen (CRM, Wedding Workspace,
Vendor OS, Customer Portal) should be designed against it, not just this dashboard.

The roles below are more granular than the 4 in §2: **Vendor is not one experience.**
A Venue Owner, a Photographer, and a Decorator run genuinely different businesses and
should each see a home screen built around their own actual workflow, not a
one-size-fits-all vendor UI:

- Founder Dashboard (§4.1)
- Sales Dashboard (§4.2)
- Venue Dashboard, Photographer Dashboard, Decorator Dashboard, Caterer Dashboard,
  … (§4.4 — category-specific views within the single Vendor role)
- Customer Dashboard (`05-customer-portal.md`)

**Companion principle — the usability bar for every screen:**
> "Can my father or an uncle who has never used CRM software complete this task
> without training?"

If the answer is no, redesign it. Concretely, this means:
- Simple language, not technical/CRM jargon, in every label and empty state
- Show only the actions relevant to the user's role — no admin/system-config noise
  on a Venue Owner's screen
- Prioritize "today's work" over analytics — a business owner opens the app to see
  what needs doing today, not a chart
- Keep the first experience minimal and expandable, not maximal — don't front-load
  every possible feature on day one
- Design mobile-first — vendors and sales reps are working from a phone, not a desk

**Why this matters beyond ShaadiShopping:** the long-term ambition is for this
platform to eventually work for other banquet halls, wedding planners,
photographers, decorators, caterers, makeup artists, DJs, and event companies as
their own users, not just ShaadiShopping's internal team and vendor roster. Every
design decision from here on should hold up against: **"will this still work when
10,000 vendors across many categories are using it?"** — see `README.md`'s "Future
Direction" section for the multi-tenancy/SaaS question this raises architecturally.

## 1. Purpose

**Who uses it:** Super Admin/Founder, Sales team, Operations/coordination staff,
Vendors. (Customers do not use the Command Center — see the future
`05-customer-portal.md`.)

**What decisions it needs to support**, grounded in the actual stated pain point
(not hypothetical): the founder is currently the only person handling follow-ups,
and specifically wants a single view of booked/available dates **across every
vendor category — not just venues**. Every other requirement below builds outward
from that concrete need.

Broadly, the Command Center should answer, at a glance, per role:
- Founder: "Is the business healthy today, and where does it need my attention?"
- Sales: "Who do I need to follow up with right now, and how am I doing against target?"
- Operations: "What's happening today, and what's blocked?"
- Vendor: "What's my calendar, what's new, and what have I earned?"

## 2. User roles

| Role | Maps to `prisma/schema.prisma` `Role` enum? |
|---|---|
| Founder | `SUPER_ADMIN` |
| Sales | `SALES` |
| Operations | `OPERATIONS` — ✅ resolved (added as a genuine 5th enum value, Phase B schema, see `schema-draft-1-notes.md`) |
| Vendor | `VENDOR` |

~~Gap, flagged not silently resolved~~ — **resolved.** The gap this section originally
flagged (no Operations role existed) is closed: `Role.OPERATIONS` is a real enum
value in `prisma/schema.prisma` today.

## 3. Dashboard layout (shared pattern across all roles)

**Revised (2026-07-21): "Today's Work" leads every dashboard, not analytics.**
Originally this layout put a KPI strip first. Per the Role-Based Experience
principle above (and the "grandpa test"), every role's dashboard now opens with
action items — what needs doing today — with KPIs/analytics demoted below, not
removed:

```
┌─────────────────────────────────────────────────────┐
│ Today's Work — action items, role-specific           │
│ (e.g. Founder: follow-ups, site visits, payments      │
│  pending, weddings today, overdue tasks)              │
├─────────────────────────────────────────────────────┤
│ Alerts panel (role-filtered, see §5)                 │
├─────────────────────────────────────────────────────┤
│ KPI strip (3-5 headline numbers, role-specific)      │
├───────────────────────────┬───────────────────────────┤
│ Main widget grid           │ Filters sidebar (see §6)  │
│ (role-specific widgets)    │                            │
└───────────────────────────┴───────────────────────────┘
```

Same shell, different widget set per role — this is a deliberate constraint so the
system reads as one product, not four (or more, per the Role-Based Experience
principle) unrelated dashboards bolted together. "Today's Work" is a per-role
composed view (Founder's pulls from every role's due items; Sales/Vendor pull only
their own), not a new stored entity — it's a read that unions `Task.dueAt`/
`ActivityLog`/payment-due/booking-due queries already named elsewhere in this doc.

## 4. Widgets by role

For each widget: Purpose · Data source (mapped to actual/planned Prisma models) ·
KPIs shown · Refresh behavior · Permissions.

### 4.1 Founder Dashboard

**Verified against the actual Phase B schema (2026-07-21) — most gaps below,
originally flagged when this doc was written, are now closed.** Only genuine
remaining gaps are called out explicitly; everything else has a real model.

| Widget | Purpose | Data source | KPIs | Refresh | Permissions |
|---|---|---|---|---|---|
| **Today's Work** | Leads the dashboard per §3's revised layout — Founder's own due items, not analytics | Union of overdue `Task`s assigned to Founder, weddings happening today (`WeddingEvent.date`), payments pending | Count per category | Real-time | Founder only |
| Revenue Today/Month | Business health at a glance | `Invoice.amountPaid`, `Booking.total` (status CONFIRMED/CLOSED) | ₹ today, ₹ this month, vs. last month | Real-time on load | Founder only |
| New Leads | Top-of-funnel volume | `Lead` + `Enquiry` + `Consultation` counts | Count today/week, source breakdown | Real-time | Founder (full), Sales (summary) |
| Conversion Rate | Funnel health | Bookings ÷ (Leads+Enquiries+Consultations) | % this month, trend | Daily | Founder (full), Sales (own) |
| Bookings | Confirmed business | `Booking` where status=CONFIRMED/CLOSED | Count, ₹ value, list | Real-time | Founder, Operations (view) |
| Outstanding Payments | Cash flow risk | `Invoice.total - Invoice.amountPaid` where status≠PAID | ₹ outstanding, count overdue | Daily | Founder (full), Operations (view) |
| Vendor Performance | Which vendors to recommend | ✅ Computable now — `Review` + `VendorBooking` models both exist (Phase B); the composite "Vendor Score" (acceptance rate, response time, reviews, cancellation rate, on-time service, repeat bookings) is a computed-on-read aggregate, not a stored field, same pattern as `Category` vendor counts | Composite score, ranked list | Daily | Founder |
| Team Performance | Are reps converting | Bookings/Leads grouped by `assignedToId` (Phase B, real field) | Per-rep conversion %, follow-up SLA adherence | Daily | Founder (full), Sales (own row only) |
| City-wise Performance | Where to invest next | Bookings/Revenue grouped by `Vendor.city`/`Booking.city` | ₹ and count per city | Weekly | Founder |
| Monthly Targets vs. Actuals | Are we on pace | **Still a genuine gap — no `Target` model exists in the schema.** Simple entity: role/period/target amount | Target ₹, actual ₹, % attainment | Daily | Founder |
| **Vendor Availability (all categories)** | The explicitly-stated founder pain point — one view of booked/available dates across every category, not just venues | ✅ Resolved — `VendorAvailability` model exists (Phase B schema) | Available/Tentative/Booked counts per category, conflict flags | Real-time | Founder (full), Operations (full), Vendor (own only) |

### 4.2 Sales Dashboard

**Also verified against the real schema — every gap originally flagged here is
now closed** (`PipelineStage`, `Task`, `Quotation`, `assignedToId` all real).

| Widget | Purpose | Data source | KPIs | Refresh | Permissions |
|---|---|---|---|---|---|
| **Today's Work** | Leads the dashboard per §3 — this rep's own due items | `Task`s assigned to this Sales user, `dueAt` today or overdue | Count per category | Real-time | Sales (own only) |
| New Leads Assigned | Work queue | `Lead`/`Enquiry`/`Consultation`.`assignedToId` — ✅ real field (Phase B) | Count unassigned/assigned to me | Real-time | Sales (own), Founder (all) |
| Follow-ups Due Today | The core founder pain point, generalized to a team | ✅ `Task` (context=SALES_FOLLOWUP) — real model | Count due, overdue count | Real-time | Sales (own), Founder (all, summary) |
| Site Visits Scheduled | Pipeline stage tracking | ✅ `PipelineStage.SITE_VISIT_SCHEDULED` + `ActivityLog` — both real | Count today/week | Daily | Sales (own), Operations (view) |
| Quotations Sent | Mid-funnel activity | ✅ `Quotation` model exists (Phase B) | Count, ₹ value, conversion from quote to booking | Daily | Sales (own), Founder (all) |
| Deals Won/Lost | Close-rate tracking | ✅ `PipelineStage.WON`/`LOST` + `lostReason` — all real fields | Count, ₹ value, win rate | Daily | Sales (own), Founder (all) |
| Personal Conversion Rate | Individual performance | Same as Founder's Team Performance, filtered to self | % this month vs. last | Daily | Sales (own only) |

### 4.3 Operations Dashboard

| Widget | Purpose | Data source | KPIs | Refresh | Permissions |
|---|---|---|---|---|---|
| **Today's Work** | Leads the dashboard per §3 | `Task`s (context=WEDDING_TASK) assigned to Operations, due today/overdue | Count per category | Real-time | Operations only |
| Today's Events | What's happening now | ✅ `Wedding`/`WeddingEvent` exist (Phase B) | Count, list with time/venue | Real-time | Operations, Founder (view) |
| Vendor Confirmations Pending | Execution risk | `Booking`/`BookingItem` where status=NEW/CONTACTED (Phase A, unchanged) | Count, list, days pending | Real-time | Operations, Founder (view) |
| Payment Reminders | Collections | `Invoice` overdue (same source as Founder's Outstanding Payments, actioned here) | Count, ₹, days overdue | Daily | Operations, Founder (view) |
| Timeline Progress | Per-wedding execution status | ✅ `TimelineMilestone` exists (Phase B) | % complete per active wedding | Daily | Operations, Founder (view) |
| Team Assignments | Who's doing what | ✅ `assignedToId` — real field, same as Sales | List by team member | Real-time | Operations, Founder |
| Issue Tracker | Anything blocked | **Still a genuine gap — no Issue/Blocker model exists.** Lowest priority of the remaining gaps; revisit only if Operations Dashboard implementation surfaces a real need for it | Open/resolved count | Real-time | Operations, Founder (view) |

### 4.4 Vendor Dashboard

Per the Role-Based Experience principle above, the Vendor Dashboard is not one
fixed widget set — it's a **shared core every vendor gets, plus modules that vary
by vendor category** (`Vendor.categoryId`, already a real field from Phase A). This
avoids two bad extremes: a single generic vendor UI that's cluttered with
irrelevant options for most categories, or a fully separate product per category
that fragments the platform and multiplies maintenance cost.

**Shared modules (every vendor, every category):**

| Widget | Purpose | Data source | KPIs | Refresh | Permissions |
|---|---|---|---|---|---|
| Today's Work | What needs doing right now — the single most important widget per the usability principle above | Union of this vendor's due items across the modules below | Count | Real-time | Vendor (own only) |
| Calendar (Available/Tentative/Booked) | The vendor's own availability | ✅ `VendorAvailability` exists (Phase B) — same model as Founder's cross-category view, scoped to one vendor | Calendar grid | Real-time | Vendor (own only), Founder/Operations (view any) |
| Payments | Payout tracking | ✅ `Payout`/`PayoutBatch`/`CommissionRate` exist (Phase B), ties into `06-finance.md` | ₹ earned, ₹ pending payout | Daily | Vendor (own only) |
| My Profile | Self-service profile + notifications | `Vendor`, `VendorProfile` — already exist | Edit form | On demand | Vendor (own only) |
| New Enquiries | Incoming leads for this vendor | `Enquiry` where `vendorId` = self — **already exists, Milestone 2's repository layer could serve this today once wired up** | Count new/responded | Real-time | Vendor (own only) |
| Booking Requests | Confirmed/pending work | `BookingItem` where `vendorId` = self — **already exists** | Count, list | Real-time | Vendor (own only) |
| Reviews | Reputation | ✅ `Review` model exists (Phase B) — `Vendor.rating`/`reviewCount` become computed-on-read from these, not bare aggregates | Rating, count, recent reviews | Daily | Vendor (own only), public (aggregate only) |
| Package Management | Self-service pricing | `VendorPackage` — **already exists, repository already built (Milestone 2)** | List, edit | Real-time | Vendor (own only) |

**Category-specific modules** — fully specified for the 4 highest-volume categories
today (`venue`, `photo-video`, `decorator`, `catering` in `data/seedData.ts`'s
category list); the same shared-core-plus-category-modules pattern generalizes to
the platform's other ~18 categories (makeup, mehndi, band, dj, accommodation, …),
detailed as each is actually prioritized rather than speccing all of them speculatively
today:

| Category | Modules | Notes |
|---|---|---|
| **Venue** | Hall Availability (per-hall, not just per-vendor — a venue may have multiple halls), Menu Packages | `VendorPackage` already models packages generically; hall-level sub-availability is a gap if a venue has more than one hall/space |
| **Photographer** | Shoot Schedule, Album Delivery status, Equipment Checklist (future) | Shoot Schedule is the Photographer's view of Booking Requests, reframed around shoot dates rather than generic "bookings" |
| **Decorator** | Event Schedule, Material Checklist (future), Team Assignment (future) | Material/Team concepts are new, not modeled anywhere yet — flagged as future, not built now |
| **Caterer** | Event Schedule, Menu/Guest Count per booking, Material Checklist (future) | Guest count already exists on `Booking`/`Wedding` — caterer view surfaces it per-event rather than inventing a new field |

**Availability Management** (self-service calendar editing) is a cross-cutting
capability on top of the shared Calendar widget, not category-specific — uses the
same `VendorAvailability` model as the Calendar widget above.

## 5. Alerts (role-filtered)

- **Overdue follow-ups** — Sales (own), Founder (all), Operations (all)
- **Double bookings** — a vendor confirmed for two overlapping events — Operations, Founder, the affected Vendor
- **Vendor availability conflicts** — a booking attempted against a vendor marked unavailable — Operations, Founder, Sales (at point of booking)
- **Payment reminders** — overdue invoices — Founder, Operations

## 6. Filters

Date range · City · Vendor category · Sales executive (assigned-to) · Wedding
status. All required fields (`assignedToId`, `Wedding`) now exist in the Phase B
schema — these filters are implementable today, not blocked on schema work.

## 7. Data model gaps — RE-VERIFIED against the real Phase B schema (2026-07-21)

This section originally listed everything this design needed that didn't exist
yet in `prisma/schema.prisma` after Phase A. **Almost everything below has since
been built** (Phase B schema, `schema-draft-1-notes.md`) — this doc was never
updated to reflect that until now. Verified directly against `prisma/schema.prisma`
(not assumed from the notes doc) before making this claim:

| Concept | Status | Notes |
|---|---|---|
| `Wedding` (+ `WeddingEvent`) | ✅ Built | Both real models |
| `VendorAvailability` | ✅ Built | Real model — the single most load-bearing gap originally named here, now closed |
| `Task` (unified, replaces the earlier separate "FollowUp"/"Timeline" language) | ✅ Built | `context` discriminator (`SALES_FOLLOWUP`/`WEDDING_TASK`) |
| `assignedToId` on `Lead`/`Enquiry`/`Consultation` | ✅ Built | Real field (named `assignedToId`, not `assignedToUserId` as earlier drafts of this doc called it) |
| `Quotation` | ✅ Built | Real model, `QuotationStatus` enum |
| `Review` (individual records) | ✅ Built | `Vendor.rating`/`reviewCount` can become computed-on-read from these |
| `Payout`/`PayoutBatch`/`CommissionRate` | ✅ Built | Ties into `06-finance.md` |
| `Target` | ❌ Still missing | The one remaining Founder Dashboard gap — no model exists. Simple entity: role/period/target amount |
| Explicit "lost" state | ✅ Built | `PipelineStage.LOST` + `Lead`/`Enquiry`/`Consultation.lostReason` |
| "Operations" role | ✅ Built | `Role.OPERATIONS` |
| Issue/Blocker tracker (Operations) | ❌ Still missing | Lowest priority of what remains — no model exists, not clearly needed yet |
| Hall-level sub-availability (Venue category) | ❌ Still missing | Only matters if a venue has multiple bookable halls — unconfirmed as a real scenario, don't build ahead of confirming it |

**What this means for Milestone 5: the schema is not the blocker for any of the
CRM/Command Center screens specified here or in `02-crm.md`.** What's missing is
application code — repositories, services, API routes, and UI — on top of a
schema that already supports almost everything this design asked for. Only
`Target` and the Operations Issue Tracker remain genuine schema gaps, and neither
blocks Milestone 5 Sprint 5.1–5.3.

Historical context (kept for reference — everything below was true when this
section was originally written, before the Phase B schema existed):

| Concept | Needed by | Notes |
|---|---|---|
| `Wedding` (+ `WeddingService`) | Operations (Today's Events, Timeline Progress), filters (Wedding status) | Already the core architectural recommendation from the original CRM vision — this design confirms it's load-bearing, not optional |
| `VendorAvailability` / calendar | Founder (cross-category availability — the stated original pain point), Vendor (own calendar), Operations | The single most load-bearing gap — it's the literal reason this whole dashboard was requested |
| `FollowUp`/`Task` | Sales (Follow-ups Due Today), Operations (Timeline Progress) | Generalizes the founder's manual follow-up process into a real entity |
| `assignedToUserId` on `Lead`/`Enquiry` | Sales (New Leads Assigned, Personal Conversion), Founder (Team Performance), Operations (Team Assignments) | Small addition, high leverage — unlocks per-rep everything |
| `Quotation` | Sales (Quotations Sent) | Named in the original sidebar nav as distinct from Invoices/Contracts, never modeled |
| `Review` (individual records) | Vendor (Reviews widget) | `Vendor.rating`/`reviewCount` are currently just aggregate numbers with nothing behind them |
| `Payout`/`Commission` | Vendor (Earnings) | Ties into the future `06-finance.md` |
| `Target` | Founder (Monthly Targets vs. Actuals) | Simple entity: role/period/target amount |
| An explicit "lost" state | Sales (Deals Won/Lost) | Current `BookingStatus`/`EnquiryStatus` enums have no losing terminal state, only NEW/CONTACTED/CONFIRMED/CLOSED |
| "Operations" role | All Operations Dashboard permissions | See §2 — needs a decision on enum value vs. permission flag |
| Hall-level sub-availability | Venue category dashboard (§4.4) | Only matters if a single `Vendor` (venue) has multiple bookable halls/spaces — not yet confirmed as a real scenario in the current vendor data, don't build ahead of confirming it |

## 8. Future enhancements (not this pass)

- AI follow-up assistant (surfacing exactly the "Lead #245, no reply in 5 days..."
  nudge from the original CRM vision)
- AI vendor recommendations
- AI summaries
- Predictive lead scoring / forecasting

## 9. Build order

Design is unified (this document), but implementation is sequenced. **Milestone 5
(2026-07-21) sequences the Sales-side pieces of this first, ahead of the Founder
Dashboard**, since the CRM (Lead Inbox, Pipeline, Follow-ups) is the more urgent
gap — Founder's own dashboard (Sprint 5.4) comes after:

- Sprint 5.1 — CRM Dashboard (Lead list, search, filters)
- Sprint 5.2 — Lead Workspace (customer profile, timeline, follow-ups, notes)
- Sprint 5.3 — Lead Pipeline (status changes, activity history, assignments, reminders)
- Sprint 5.4 — Founder Dashboard (Today's Work, revenue, pipeline, vendor availability, overdue tasks)

Operations and Vendor dashboards remain sequenced after Milestone 5, per the
original Founder → Sales → Operations → Vendor build order — Milestone 5 only
reorders Founder vs. Sales within that sequence, it doesn't change what comes
after CRM.
