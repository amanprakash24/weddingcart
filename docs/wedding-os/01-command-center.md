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
| Operations | **No existing mapping — see gap below** |
| Vendor | `VENDOR` |

**Gap, flagged not silently resolved:** "Operations" appears here for the first
time in this project's history — the current `Role` enum (`SUPER_ADMIN`, `SALES`,
`VENDOR`, `CUSTOMER`, set in Milestone 1) has no Operations role. Before this
dashboard gets built, decide whether Operations is (a) a genuinely new 5th enum
value, or (b) `SALES` with an additional permission flag/scope. This affects the
Phase B schema migration, not Phase A (already shipped) — no urgency to resolve
before finishing the database migration, but it needs a decision before Operations
Dashboard implementation starts.

## 3. Dashboard layout (shared pattern across all 4 roles)

```
┌─────────────────────────────────────────────────────┐
│ Top KPI strip (3-5 headline numbers, role-specific)  │
├─────────────────────────────────────────────────────┤
│ Alerts panel (role-filtered, see §5)                 │
├───────────────────────────┬───────────────────────────┤
│ Main widget grid           │ Filters sidebar (see §6)  │
│ (role-specific widgets)    │                            │
└───────────────────────────┴───────────────────────────┘
```

Same shell, different widget set per role — this is a deliberate constraint so the
system reads as one product, not four unrelated dashboards bolted together.

## 4. Widgets by role

For each widget: Purpose · Data source (mapped to actual/planned Prisma models) ·
KPIs shown · Refresh behavior · Permissions.

### 4.1 Founder Dashboard

| Widget | Purpose | Data source | KPIs | Refresh | Permissions |
|---|---|---|---|---|---|
| Revenue Today/Month | Business health at a glance | `Invoice.amountPaid`, `Booking.total` (status CONFIRMED/CLOSED) | ₹ today, ₹ this month, vs. last month | Real-time on load | Founder only |
| New Leads | Top-of-funnel volume | `Lead` + `Enquiry` + `Consultation` counts | Count today/week, source breakdown | Real-time | Founder (full), Sales (summary) |
| Conversion Rate | Funnel health | Bookings ÷ (Leads+Enquiries+Consultations) | % this month, trend | Daily | Founder (full), Sales (own) |
| Bookings | Confirmed business | `Booking` where status=CONFIRMED/CLOSED | Count, ₹ value, list | Real-time | Founder, Operations (view) |
| Outstanding Payments | Cash flow risk | `Invoice.total - Invoice.amountPaid` where status≠PAID | ₹ outstanding, count overdue | Daily | Founder (full), Operations (view) |
| Vendor Performance | Which vendors to recommend | **Needs the "Vendor Score" concept from the CRM vision** — booking acceptance rate, response time, reviews, cancellation rate, on-time service, repeat bookings | Composite score, ranked list | Daily | Founder |
| Team Performance | Are reps converting | Bookings/Leads grouped by assigned Sales user | Per-rep conversion %, follow-up SLA adherence | Daily | Founder (full), Sales (own row only) |
| City-wise Performance | Where to invest next | Bookings/Revenue grouped by `Vendor.city`/`Booking.city` | ₹ and count per city | Weekly | Founder |
| Monthly Targets vs. Actuals | Are we on pace | **Needs a Target concept — doesn't exist yet** | Target ₹, actual ₹, % attainment | Daily | Founder |
| **Vendor Availability (all categories)** | The explicitly-stated founder pain point — one view of booked/available dates across every category, not just venues | **Needs a VendorAvailability/Calendar concept — doesn't exist yet** | Available/Tentative/Booked counts per category, conflict flags | Real-time | Founder (full), Operations (full), Vendor (own only) |

### 4.2 Sales Dashboard

| Widget | Purpose | Data source | KPIs | Refresh | Permissions |
|---|---|---|---|---|---|
| New Leads Assigned | Work queue | `Lead`/`Enquiry` — **needs an `assignedToUserId` field, doesn't exist yet** | Count unassigned/assigned to me | Real-time | Sales (own), Founder (all) |
| Follow-ups Due Today | The core founder pain point, generalized to a team | **Needs a FollowUp/Task entity — doesn't exist yet** | Count due, overdue count | Real-time | Sales (own), Founder (all, summary) |
| Site Visits Scheduled | Pipeline stage tracking | **Needs a Timeline/Activity entity — doesn't exist yet** | Count today/week | Daily | Sales (own), Operations (view) |
| Quotations Sent | Mid-funnel activity | **Needs a Quotation entity — the original sidebar nav named "Quotations" separately from "Invoices," but no such model exists today** | Count, ₹ value, conversion from quote to booking | Daily | Sales (own), Founder (all) |
| Deals Won/Lost | Close-rate tracking | `Booking.status`/`Enquiry.status` = CLOSED (won) vs. abandoned (lost — needs an explicit "lost" state, current enums don't have one) | Count, ₹ value, win rate | Daily | Sales (own), Founder (all) |
| Personal Conversion Rate | Individual performance | Same as Founder's Team Performance, filtered to self | % this month vs. last | Daily | Sales (own only) |

### 4.3 Operations Dashboard

| Widget | Purpose | Data source | KPIs | Refresh | Permissions |
|---|---|---|---|---|---|
| Today's Events | What's happening now | **Needs the Wedding/Event entity from Phase B — doesn't exist yet** | Count, list with time/venue | Real-time | Operations, Founder (view) |
| Vendor Confirmations Pending | Execution risk | `Booking`/`BookingItem` where status=NEW/CONTACTED | Count, list, days pending | Real-time | Operations, Founder (view) |
| Payment Reminders | Collections | `Invoice` overdue (same source as Founder's Outstanding Payments, actioned here) | Count, ₹, days overdue | Daily | Operations, Founder (view) |
| Timeline Progress | Per-wedding execution status | **Needs a Timeline entity (site visit → booking → payment → event day), from the original CRM vision's Wedding Command Center concept** | % complete per active wedding | Daily | Operations, Founder (view) |
| Team Assignments | Who's doing what | Same `assignedToUserId` gap as Sales | List by team member | Real-time | Operations, Founder |
| Issue Tracker | Anything blocked | **New concept, not modeled anywhere yet** | Open/resolved count | Real-time | Operations, Founder (view) |

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
| Calendar (Available/Tentative/Booked) | The vendor's own availability | **Needs VendorAvailability — same gap as Founder's cross-category view, this is that view scoped to one vendor** | Calendar grid | Real-time | Vendor (own only), Founder/Operations (view any) |
| Payments | Payout tracking | **Needs a Payout/Commission entity — doesn't exist yet, ties into the future `06-finance.md`** | ₹ earned, ₹ pending payout | Daily | Vendor (own only) |
| My Profile | Self-service profile + notifications | `Vendor`, `VendorProfile` — already exist | Edit form | On demand | Vendor (own only) |
| New Enquiries | Incoming leads for this vendor | `Enquiry` where `vendorId` = self — **already exists, Milestone 2's repository layer could serve this today once wired up** | Count new/responded | Real-time | Vendor (own only) |
| Booking Requests | Confirmed/pending work | `BookingItem` where `vendorId` = self — **already exists** | Count, list | Real-time | Vendor (own only) |
| Reviews | Reputation | **No Review entity exists — `Vendor.rating`/`reviewCount` today are just aggregate numbers with no individual review records behind them** | Rating, count, recent reviews | Daily | Vendor (own only), public (aggregate only) |
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
capability on top of the shared Calendar widget, not category-specific — same
VendorAvailability gap noted above.

## 5. Alerts (role-filtered)

- **Overdue follow-ups** — Sales (own), Founder (all), Operations (all)
- **Double bookings** — a vendor confirmed for two overlapping events — Operations, Founder, the affected Vendor
- **Vendor availability conflicts** — a booking attempted against a vendor marked unavailable — Operations, Founder, Sales (at point of booking)
- **Payment reminders** — overdue invoices — Founder, Operations

## 6. Filters

Date range · City · Vendor category · Sales executive (assigned-to) · Wedding
status. The last two both depend on gaps noted in §7 (`assignedToUserId`, the
`Wedding` entity) — filters can't fully work until those exist.

## 7. Data model gaps this design surfaces

Everything below is required by this functional design but does **not** exist in
`prisma/schema.prisma` as it stands after Phase A (the 1:1 Mongo port). This list is
the concrete input for Phase B's schema design — a functional requirement driving
the schema, not a schema invented ahead of the requirement:

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

Design is unified (this document), but implementation is sequenced:
**Founder → Sales → Operations → Vendor** — matching the founder's most immediate
need first, while keeping the full system's shape defined up front so each phase
doesn't require redesigning the ones before it.
