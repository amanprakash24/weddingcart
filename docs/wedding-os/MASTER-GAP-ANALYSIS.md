# Vivah OS — Master Gap Analysis

*Audit of 3 Oct 2026, main = `69b3f70`. Supersedes nothing — `13-roadmap-v2.md` stays the backlog; this document judges every
workflow against the bar in the audit brief: complete = **database + API + business logic + UI + permissions + workflow
connection + tests + production verification**. Evidence: [MASTER-SYSTEM-FLOW.md](MASTER-SYSTEM-FLOW.md),
[MASTER-PIPELINE-MATRIX.md](MASTER-PIPELINE-MATRIX.md).*

**Columns.** *Exists*: code is on main. *Connected*: every step hands over to the next without a person re-typing. *Tested*:
unit tests exist (no CI, no browser tests anywhere). *Production*: used for real (live data, 3 Oct). *UX ready*: a basic phone
user could do it without training.

## 1. Workflow scorecard

| Area | Exists | Connected | Tested | Production | UX Ready | Gap |
|---|---|---|---|---|---|---|
| Public discovery (vendor / venue / city pages) | ✅ | ✅ | ✅ | ✅ 7 published vendors | ✅ | hand-entered ratings shown as if real (1.4 relabels the vendor page) |
| Enquiry capture (Lead / Enquiry / Consultation / cart) | ✅ | ✅ | ✅ | ✅ 30 consultations | ✅ | staff cannot add a phone-call enquiry; no rate limit on public forms |
| CRM inbox, assignment, follow-ups | ✅ | ✅ | ✅ | 🟡 used lightly | 🟡 desktop, CRM words ("Pipeline", "Stage") | old admin tabs edit a second status |
| Vendor availability check (vendor enquiry, 1.1) | ✅ | ✅ | ✅ | ❌ 0 sent yet | ✅ | not yet exercised live |
| Proposal + detailed quotation (1.2) | ✅ | ✅ | ✅ | 🟡 1 draft quotation, 0 sent since | ✅ mobile | "Advance to confirm" shows the quote's advance, not the 25% |
| Request changes → revision | ✅ | ✅ | ✅ | ❌ unused | ✅ | — |
| Acceptance → booking → agreement (25% rule) | ✅ | ✅ | ✅ unit + golden | ❌ 0 accepted | 🟡 | — |
| Staff-recorded payments | ✅ | ✅ | ✅ | ❌ 0 payments | 🟡 table scrolls sideways on a phone | — |
| Couple pays by UPI + proof (1.3) | ⏳ #149 | ✅ | ✅ | ❌ | not seen in a browser | needs backup → migration → UPI env → merge |
| Receipts for the couple | 🟡 staff JSON only | — | — | ❌ | ❌ | #149 adds printable receipts |
| Razorpay payment links | ✅ | ✅ | ✅ golden | ❌ | 🟡 | needs live keys |
| Wedding ID + workspace (functions, vendor bookings, tasks, timeline) | ✅ | ✅ | ✅ db | 🟡 1 wedding | 🟡 desktop | — |
| Vendor confirms / declines a booking | ❌ staff do it | — | — | — | — | vendor sees bookings but cannot answer |
| Guests + RSVP | ✅ | 🟡 links shared one by one | ❌ | ❌ 0 guests | 🟡 | no bulk WhatsApp send |
| **Customer Portal** (wedding, approvals, own guests) | ✅ | 🔴 `Wedding.customerId` never set | ❌ | ❌ | — | **broken: empty for every wedding** |
| Client approvals | ✅ | 🔴 same | ❌ | ❌ | — | notification row written, never delivered |
| Documents | 🟡 read-only | ❌ no upload | ❌ | ❌ 0 | ❌ | nothing can be uploaded |
| Notifications | 🟡 table | ❌ nothing reads or sends | ❌ | ❌ 0 | — | WhatsApp only on new consultation + some booking updates |
| Vendor payouts | ✅ | 🟡 manual PENDING→PAID | ✅ | ❌ | 🟡 | — |
| Wedding completion | ✅ | ✅ | ✅ db | ❌ | ✅ | — |
| Reviews (1.4) | ⏳ #150 | ✅ | ✅ | ❌ | not seen in a browser | needs #149 first, then its migration |
| Founder "Today" (Command Center) | ✅ | ✅ | ✅ | 🟡 | 🟡 desktop tables | no commission / SaaS revenue, no partner or vendor-response view, no audit of old → new values |
| Growth Partner | ✅ | 🔴 referral not linked to any lead / wedding | ✅ | 🟡 2 partners, 0 referrals | ✅ | conversion and payout are hand-typed |
| Commission tiers / partner agreements | 🟡 schema only | ❌ | ❌ | ❌ | — | `PartnerTier`, `PartnerAgreement` unused |
| **Venue runs its own business** (own enquiries, customers, quotes, bookings) | ❌ | ❌ | ❌ | ❌ | ❌ | **no record ownership — every record is Shaadi Shopping's** |
| New Vendor OS (Today / Weddings / Services / Availability / Payments) | ⏳ local branch only | ? | ? | ❌ | designed mobile-first | never pushed; 75 commits behind main |
| SaaS plans / billing | ❌ | — | — | — | — | not started (by plan, Block 2) |
| CI / browser end-to-end tests | ❌ | — | — | — | — | tests run only by hand; `tests-db` never runs automatically |

---

## 2. Report

### 2.1 What already works (end to end, in code)
- Couple discovery → three ways to enquire → one CRM inbox with assignment, follow-ups, notes and automatic stages.
- Vendor availability requests and answers (Vendor OS), with staff alerts.
- Quotation with versions → secret proposal link (visual proposal + detailed quotation, print) → request changes → accept.
- Acceptance → booking + frozen agreement → advance invoice for 25% → payments → Date Held / auto-confirm → **Wedding ID** with
  functions, vendor bookings, tasks and timeline — proven by the 16-step golden test.
- Wedding operations for staff: functions, vendors (cancel / replace / re-price), tasks, timeline, guests and RSVP links, payouts,
  completion.
- Vendor onboarding → login by OTP → availability calendar.
- Founder "Today" screen; Growth Partner sign-up and referral capture; vendor prospects for sales outreach.

### 2.2 Partly connected
- **Guests / RSVP**: works, but each RSVP link is opened and shared by hand.
- **Payments**: staff-recorded only on main; UPI for couples waits in #149; Razorpay needs live keys.
- **Payouts and partner payouts**: statuses typed by hand; the partner payout is a number on the referral, not a money record.
- **Cart bookings**: confirmed from the old Bookings tab (Booking has only its own status, outside the CRM stages).
- **Proposal link**: staff copy it into WhatsApp themselves; a lost link after acceptance can't be replaced until #150.
- **Vendor bookings**: vendor sees them and sets the venue hold, but cannot accept or decline.

### 2.3 Missing
- A venue/vendor **adding their own enquiry, customer, quotation, booking or payment** (brief Flow A).
- Staff adding an enquiry from a phone call in the CRM.
- Document upload. Notification delivery. A vendor accept/decline. Bulk RSVP send.
- Commission ledger, partner tiers in use, SaaS plans.
- An audit trail of *old → new* values (the activity log records events, not field changes).
- CI and any browser end-to-end test.

### 2.4 Broken connections
1. **`Wedding.customerId` is never written** → Customer Portal, client approvals and couple-managed guests show nothing for any
   real wedding (live: 0 of 1).
2. **Two status fields per capture record** → old admin tabs write `status`, the CRM writes `pipelineStage`, never synced (live:
   17 consultations "Closed" but stage "New", 2 "New" but "Lost").
3. **Partner referral → CRM**: no link, so conversion and payout cannot be checked against a real booking.
4. **Approval notifications** are written to a table nothing reads.

### 2.5 Duplicate systems
| Duplicate | Where | Recommendation |
|---|---|---|
| Old admin tabs vs CRM (Bookings, Enquiries, Consultations, Leads) | `/admin?tab=…` vs `/admin/crm` | retire the old tabs, keep one status |
| `status` vs `pipelineStage` | Enquiry, Consultation (Lead has only the stage; Booking only a status) | one state, derived labels |
| Two couple surfaces: proposal link vs Customer Portal | `/proposal/[token]` vs `/customer` | pick one home for the couple (the link works today) |
| Two Vendor OS versions | main `VenuePortalClient` vs local `feat/vivah-os-design-components` | rebase and connect the new one; do not build a third |
| Standalone invoices vs agreement invoices | `/admin?tab=invoices` vs Money card | keep standalone only for non-wedding sales |
| Hand-entered ratings vs couple reviews | `Vendor.rating` vs `reviews` | kept apart by decision (#150) |
| Two dashboard services | `founderDashboard.service` + `commandCenter.service` + `stats.service` | one Today service per role |

### 2.6 UX problems
- Software words on staff screens: "Pipeline" (5 components), "Stage", "Assign", "Convert".
- Two generations of admin screens in one sidebar; the old ones look and behave differently.
- Errors: unexpected failures reach users as **"Internal server error"** or **"Invalid request"**; not-found errors include raw ids
  (`Wedding not found: 3f2…`).
- Empty states mostly say "No X yet" without saying what to do next.
- Next-action guidance exists in places (`leadJourney`, wedding `controlRoom`, proposal `nextStep`) but not as one primary
  action per screen.

### 2.7 Mobile problems
- The CRM, lead workspace, wedding workspace and Command Center are desktop-first (tables in `LeadTable`, `CommandCenter`,
  `TeamPerformanceCard`, `ServiceRequirements`, the Money card's payment table `min-w-[520px]`).
- Vendor OS on main is one long page; the mobile-first redesign is on the unmerged branch.
- Mobile-ready today: public pages, `/plan`, the proposal link, RSVP.

### 2.8 Critical business blockers
1. **No record ownership.** Vivah OS cannot be a venue's own system until a record can belong to a venue (and a venue's staff),
   and every query respects it. This is the foundation for Flow A, for SaaS, and for privacy between venues.
2. **The couple's logged-in home is broken** (`Wedding.customerId`).
3. **Nothing has been used end to end with real money** — 0 accepted quotations, 0 payments. The flow is proven only in tests.
4. **No automatic tests run anywhere** — every merge relies on someone running tests by hand.

### 2.9 Recommended implementation order
Rule applied (brief §22): *does it help a venue / vendor / couple finish the wedding workflow?*

| # | Step | Why first | Size |
|---|---|---|---|
| 0 | **Land what is built**: #149 (backup → migration → UPI env → merge), #150 (backup → migration → merge); read-only production check | finished work, no new risk | small |
| 1 | **Fix the four broken connections**: set `Wedding.customerId` from the booking/couple phone (+ backfill 1 wedding); retire the old admin tabs or make them write the CRM stage; link `PartnerReferral` to the lead it becomes; plain-language error messages | cheap, removes wrong data and dead screens | small–medium, one migration |
| 2 | **CI**: run `bun test` (and `tests-db` on a throwaway database) on every PR | every later step depends on it | small |
| 3 | **Decide record ownership** (design doc only, then approval): owner = Shaadi Shopping *or* a venue; venue staff logins; what Shaadi Shopping may see of a venue's own customers | the foundation for Flow A and SaaS | decision |
| 4 | **Rebase the new Vendor OS branch** onto main and connect it (Today, Weddings, Availability, Payments) instead of building a third version | existing asset, mobile-first | medium |
| 5 | **Venue Flow A, mobile-first**: "+ New Enquiry" → follow-up → quotation (reuse the quotation, proposal link, agreement and payment services, scoped by owner) → booking → Wedding ID | the product test in the brief §26 | large, sliced |
| 6 | **Today screens + plain words** for venue, vendor and founder (one primary action per screen, guided empty states) | understandable without training | medium |
| 7 | Vendor accept/decline; document upload; WhatsApp delivery for proposal / RSVP / payment reminders | removes manual copy-paste | medium |
| 8 | Revenue engines (Roadmap Block 2: commercial status + tiers, commission ledger, SaaS plans) | after a venue can run its business in Vivah OS | large |

**Change to the approved roadmap:** the approved order put revenue engines (Block 2) next. This audit recommends steps 1–5
first, because Block 2's SaaS plans have nothing to sell until a venue can manage its own enquiries (blocker 1). Your call.

*End of audit. No code was changed for it.*
