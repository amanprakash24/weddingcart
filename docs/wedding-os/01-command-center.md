# Command Center — Functional Design

One system, four role-based views. Designed together (per the principle: every KPI
needs one clear owner, and designing roles in isolation leads to rework once the
others are defined), built incrementally: **Founder → Sales → Operations → Vendor**.

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

| Widget | Purpose | Data source | KPIs | Refresh | Permissions |
|---|---|---|---|---|---|
| Calendar (Available/Tentative/Booked) | The vendor's own availability | **Needs VendorAvailability — same gap as Founder's cross-category view, this is that view scoped to one vendor** | Calendar grid | Real-time | Vendor (own only), Founder/Operations (view any) |
| New Enquiries | Incoming leads for this vendor | `Enquiry` where `vendorId` = self — **already exists, Milestone 2's repository layer could serve this today once wired up** | Count new/responded | Real-time | Vendor (own only) |
| Booking Requests | Confirmed/pending work | `BookingItem` where `vendorId` = self — **already exists** | Count, list | Real-time | Vendor (own only) |
| Earnings | Payout tracking | **Needs a Payout/Commission entity — doesn't exist yet, ties into the future `06-finance.md`** | ₹ earned, ₹ pending payout | Daily | Vendor (own only) |
| Reviews | Reputation | **No Review entity exists — `Vendor.rating`/`reviewCount` today are just aggregate numbers with no individual review records behind them** | Rating, count, recent reviews | Daily | Vendor (own only), public (aggregate only) |
| Package Management | Self-service pricing | `VendorPackage` — **already exists, repository already built (Milestone 2)** | List, edit | Real-time | Vendor (own only) |
| Availability Management | Self-service calendar | Same VendorAvailability gap | Calendar edit | Real-time | Vendor (own only) |

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
