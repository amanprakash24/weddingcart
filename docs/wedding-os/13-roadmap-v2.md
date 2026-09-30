# 13 — Roadmap v2 (blueprint v2.0 vs. the code)

Compares the master blueprint *Revised Doc for Shaadi Shopping & Vivah OS* (v2.0, 101 sections — not a repo file)
with the code on `main` as of **30 Sep 2026** (`5991f01`). Every status was checked against `prisma/schema.prisma` and
real application usage, not assumed. Roadmap order **approved 30 Sep 2026**. Daily progress: `docs/worklog/`.

## 1. The MVP flow (§89)

| Step | Status |
|---|---|
| Search → Enquiry → CRM → Assignment → Salesperson | ✅ built |
| Salesperson → Vendor/Venue | 🟡 staff pick vendors; **no vendor enquiry or response** (§43) |
| Proposal → Quotation → Customer approval | ✅ built (08-quotation.md §15–16) |
| Booking → Wedding ID → Wedding Workspace | ✅ built |
| Payment | 🟡 staff record payments (25 % confirmation rule); no customer-side UPI/QR |
| Event → Completion → Review | 🔴 event-day mode is a placeholder; no completion/review flow (`Review` model unused) |

Not yet run end-to-end with a real customer (worklog: Step 8B-A).

## 2. By blueprint phase (§88)

| Phase | Built | Partial | Missing |
|---|---|---|---|
| 1 Foundation | auth, roles (SUPER_ADMIN/SALES/OPERATIONS/VENDOR/CUSTOMER), core IDs | activity timeline (no old→new audit, §60); coarse permissions | Founder/Manager/Finance roles (§39), team/org, notifications (model unused) |
| 2 CRM | leads, enquiries, consultations, pipeline, assignment, follow-ups, timeline | lead SLA (§42) | My Work per role (§40), escalation |
| 3 Marketplace | profiles, packages, vendor-editable availability, publish status | verification | completeness & setup progress (§63/66), multiple halls (§29), seasonal pricing |
| 4 Commerce | proposal, quotation, revisions, request changes, online accept, booking, 25 % rule + hold | readiness checks (§46), cancellation without refund | vendor enquiry (§43), rescheduling (§49), proposal ≠ detailed quotation (Decision 10) |
| 5 Wedding OS | workspace, Wedding ID, functions, tasks, timeline, vendor bookings, documents | wedding health (§61) | communication hub (§25) |
| 6 Finance | invoices, payments, agreement, payouts | commission per category only; `PartnerTier`/`PartnerAgreement` in schema but unused; single budget | commercial status (§13), commission ledger (§51), SaaS subscriptions (§52), expenses/profit (§37), receipts |
| 7 Operations | vendor bookings, venue status | — | notifications, issues (§53), support (§54), event-day mode (§67), action centers (§55) |
| 8 Client | guests & RSVP, approvals, finance snapshot | most of Client OS is read-only (~40 %) | compare/shortlist (§22), budget breakdown, checklist templates (§23), document upload, profile self-edit |
| 9 Analytics | founder dashboard (basic) | — | vendor / sales / finance / SaaS analytics (§80) |
| 10 AI | — | schema only | copilots (§76–79) |

Blueprint decisions (§99) not yet met: 5–6 (commission or SaaS), 10 (separate proposal & detailed quotation);
Decision 18 (work log) started 30 Sep 2026.

## 3. Approved roadmap order

**0 · Stabilise** — merge lint PRs (#142, then PR B), real walkthrough (8B-A), onboard 2–3 vendor logins, staff brief.

**1 · Close the MVP flow**
1. **Built 30 Sep 2026 — see 04-vendor-os.md §9.** Vendor enquiry & response (§43): vendors on a proposal get the request in Vendor OS and answer Available / Not
   available / With conditions / Another date; never blocks sales; staff alerted on "not available".
2. Proposal vs. detailed quotation as separate experiences (Decision 10).
3. Customer payment: UPI/QR + payment proof; receipts.
4. Completion & review: wedding completed → review request tied to the booking → reviews on vendor profiles.

**2 · Two revenue engines** (§10–13, 51–52, 92)
1. Vendor commercial status: Commission Partner / SaaS / Both / Marketplace only / Inactive — using the existing
   `PartnerAgreement` (Partner 10 %, Growth 12 %, Premium 15 %).
2. Commission ledger: booking value × tier %, payment & settlement status (internal only).
3. SaaS plans ₹2,999 / ₹5,999 / ₹10,999 — tracked and invoiced manually first; the plan gates Vendor OS features.
4. Founder view: commission revenue vs. SaaS revenue.

**3 · Operations foundation** — notifications (in-app, then WhatsApp), lead SLA & escalation, issues & support,
audit old→new, action centers.

**4 · Client OS depth** — budget ≠ quotation ≠ booking ≠ paid ≠ expense, checklist templates, document upload,
profile self-edit, event-day info, compare & shortlist.

**5 · Vendor OS depth** — completeness & setup progress, verification, multiple halls, package inclusions & seasonal
pricing, expenses & profit, vendor analytics; then team and inventory.

**6 · Roles & Command Center** — Founder/Manager/Finance roles, My Work, universal search, 360° views.

**Later** — analytics suite, AI copilots (approve-before-act, §78), rescheduling & refunds, travel & accommodation,
integrations (§87), AWS move.

Each block follows the same cycle: plan → approval → implement → test → verify → PR → review → merge → production
verification; migrations only after a backup (backup → migrate → merge).
