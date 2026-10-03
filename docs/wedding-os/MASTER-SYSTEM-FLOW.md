# Vivah OS — Master System Flow

*Audit of 3 Oct 2026. Main = `69b3f70` (PR #148, Roadmap 1.2). Built but **not merged**: PR #149 (1.3 UPI payments) and PR #150
(1.4 reviews), and the local branch `feat/vivah-os-design-components` (new Vendor OS, 23 Sep, never pushed). Read with
[MASTER-PIPELINE-MATRIX.md](MASTER-PIPELINE-MATRIX.md) (every connection, with its API and test) and
[MASTER-GAP-ANALYSIS.md](MASTER-GAP-ANALYSIS.md) (what is missing). Earlier design docs: `domain-model.md`, `user-journeys.md`,
`13-roadmap-v2.md`; this document does not repeat them — it records what the code actually does today.*

Every claim here was traced **UI → API → service → database → what happens next**, and checked against the live database
(read-only).

---

## 1. The system in one picture

```
            ┌──────────── SHAADI SHOPPING (website) ────────────┐
 Couple ──▶ │ vendor pages · /plan wizard · cart · popups       │
            └───────┬───────────────┬──────────────┬─────────────┘
                    │ Lead          │ Enquiry      │ Consultation        (+ Booking from the cart)
                    ▼               ▼              ▼
            ┌──────────── CRM (Shaadi Shopping staff only) ─────┐
            │ one inbox · assign · follow-ups · notes · stages  │
            │ vendor picks ─▶ Vendor enquiry (vendor answers)   │
            │ Quotation ─▶ revisions ─▶ proposal link           │
            └───────┬───────────────────────────────────────────┘
                    │ couple accepts (link) or staff record it
                    ▼
            Agreement (frozen) ─▶ advance invoice (25%) ─▶ payments ─▶ Booking confirmed
                    │
                    ▼
            ┌──────────── WEDDING (Wedding ID WED-YYYY-NNNN) ────┐
            │ functions · vendor bookings · tasks · timeline ·   │
            │ guests/RSVP · money · approvals · payouts          │
            └───────┬────────────────────────────────────────────┘
                    ▼
            Completed  ─▶  (PR #150) reviews  ─▶  vendor page
```

**The single most important fact:** every customer record (lead, enquiry, consultation, quotation, booking, wedding) belongs to
**Shaadi Shopping staff**. There is no "this record belongs to venue X" anywhere in the database. A venue or vendor cannot add
their own enquiry, customer, quotation or booking. Section 3 explains what a vendor *can* do.

---

## 2. Shaadi Shopping (marketplace + sales team)

| Step | What happens in the code | Who |
|---|---|---|
| **Customer discovery** | Public pages: `/`, `/vendors/[slug]`, `/categories/[slug]`, `/cities/[city]/[category]`, `/venues/patna/{area}` (dynamic from `Vendor.area`), `/blog`. Only `PUBLISHED` vendors are public. | Couple |
| **Enquiry capture** | Three independent tables, by decision (20 Sep): **Lead** (popup / generic form, `POST /api/leads`), **Enquiry** (about one vendor, `POST /api/enquiries`), **Consultation** (the `/plan` wizard, `POST /api/consultations` — also sends WhatsApp to the admin and the couple). A fourth way in: **Booking** from the cart (`POST /api/bookings`, marketplace checkout, no quotation). | Couple (public, no login) |
| **CRM inbox** | `/admin/crm` merges the three into one list (`leadInbox.service`). Each has `pipelineStage`, `assignedTo`, tasks, notes, an activity timeline. | Staff |
| **Assignment & follow-up** | `POST /api/crm/leads/[type]/[id]/assign`, `…/tasks`, `…/notes`, `…/stage`. Stages move forward automatically on commercial events (`lib/crm/stageEvents.ts`). | Staff (SUPER_ADMIN, SALES, OPERATIONS) |
| **Vendor selection** | On a consultation: `ConsultationVendorSelection`. Saving a quotation or a selection creates a **VendorEnquiry** for each linked vendor (Roadmap 1.1). | Staff |
| **Proposal & quotation** | `Quotation` + `QuotationItem`, revisions (`supersedesId`), send, accept/reject, secret **proposal link** `/proposal/[token]` with two views (Your proposal / Detailed quotation, 1.2). | Staff create; couple views |
| **Approval** | Couple accepts on the link (`POST /api/proposal/[token]/accept`), or staff record it (`POST /api/quotations/[id]/accept`). Couple can "Request changes". | Couple / staff |
| **Booking + money** | Accepting creates the **Booking** and the **CommercialAgreement** (frozen deal) and the advance invoice for **25% of the total**. Staff record payments (cash/UPI/bank/cheque). At 25% the booking confirms itself and the **Wedding** is created. Under 25% = **Date Held** for 7 days. | Staff; (PR #149: couple pays by UPI, staff verify) |
| **Commission** | `CommissionRate` per category feeds vendor **payouts** (`Payout`, `PayoutBatch`). `PartnerTier` / `PartnerAgreement` exist in the schema but nothing uses them. | Staff |
| **Growth Partner** | `/growth-partner` → `GrowthPartner` (code) → `PartnerReferral`. Staff move a referral through statuses by hand. **Not connected to the CRM** (no link to any lead or wedding). | Partner / staff |
| **Founder control** | `/admin/dashboard` = Command Center ("Today"): pipeline, team performance, upcoming weddings, money due, overdue tasks (`founderDashboard.service` + `commandCenter.service`). | SUPER_ADMIN |
| **Also live, separate** | Public **events / ticketing** (`Event`, `EventOrder`, Razorpay), **blog**, **vendor prospects** (576 Patna venues to contact), **vendor applications** (onboarding). | Staff |

---

## 3. Venue / vendor (Vendor OS) — what they can really do today

A vendor logs in with **phone + OTP** (`/vendor/login`). The login works only if staff linked that phone to the vendor
(`VendorProfile`, created when a vendor application is approved). Live: **1** vendor login (Kush Travel).

| A venue must be able to (brief §3) | Today on main | Where |
|---|---|---|
| 1 Create its own enquiry | ❌ No | — |
| 2 Receive an enquiry from Shaadi Shopping | ✅ "Is the date available?" requests, answer Available / Not available / With conditions / Another date | `/vendor/enquiries` |
| 3 Create customer | ❌ | — |
| 4 Capture requirements | ❌ (sees only what staff entered) | — |
| 5 Follow up | ❌ | — |
| 6–9 Proposal / quotation / revise / send | ❌ Read-only view of **accepted** proposals they are on | `/vendor/proposals` |
| 10 Customer approval | ❌ | — |
| 11–12 Collect advance / track payment | ❌ (payouts *to* the vendor are staff-side) | — |
| 13–14 Booking / Wedding ID | 🟡 Sees their **vendor bookings** on Shaadi Shopping weddings; can set the **venue hold status**; cannot accept/decline (staff do) | `/vendor` (VenuePortalClient) |
| 15–17 Manage wedding / functions / vendors | ❌ | — |
| 18 Tasks | ❌ | — |
| 19 Documents | 🟡 Sees customer-visible documents on their bookings (none exist — there is no upload) | `/vendor` |
| 20 Remaining payments | ❌ | — |
| 21–22 Complete / request review | ❌ (PR #150: staff request reviews; vendor sees nothing) | — |
| Availability calendar | ✅ Set Available / Tentative / Booked / Blocked per date | `/vendor` → `PATCH /api/vendor/availability` |

**Not merged, local only:** `feat/vivah-os-design-components` (6 commits, 23 Sep) has a new **Vendor OS** — Today, Weddings,
Services, Availability, Payments, design tokens, a `VendorShell`, "Venue Owner" specialisation, `VendorCapability` — documented in
its `docs/wedding-os/11-vivah-os-ux-architecture.md`. It is 75 commits behind main and has never been pushed.

### What a vendor sees / cannot see

| Vendor sees | Vendor never sees |
|---|---|
| Availability requests: services, functions, date, guests, city, event type (no couple identity before acceptance) | Couple's name and phone before acceptance; customer price; other vendors' prices |
| Accepted proposals they are on (read-only) | Staff notes, CRM stage, internal tasks, agreement, commission |
| Their vendor bookings: function, date, venue, agreed price, customer-visible documents, client approvals | Bank details of anyone; other weddings |
| Their own availability | Payment proofs, invoices |

Information that **comes from Shaadi Shopping**: the enquiry, the couple, the wedding, the price agreed with the couple.
Information that **belongs to the vendor**: profile, packages, photos, availability, their response. **Customer-owned**: name,
phone, guests, RSVPs, payment proofs. **Internal**: notes, stage, tasks, commission, payouts, activity log.

---

## 4. Client / couple

| Step | Customer action | Staff action | Vendor action | Automatic |
|---|---|---|---|---|
| Discovery | browse, compare | — | — | — |
| Enquiry | form / wizard / cart | — | — | lead appears in CRM; WhatsApp to admin + couple (consultation) |
| Consultation | talk to the team | call, notes, follow-ups, pick vendors | — | vendor enquiries sent |
| Vendor check | — | record answers if needed | answer availability | staff alerted on "not available" |
| Proposal | open the link | create quote, create link, send on WhatsApp (copy) | — | first view logged |
| Detailed quotation | read, print | — | — | — |
| Request changes | write a note | revise | — | stage → Negotiation |
| Approval | accept on the link | or record acceptance | — | booking + agreement + advance invoice |
| Payment | pay (PR #149: UPI + "I have paid") | record / verify payment | — | Date Held → Confirmed at 25%; wedding created |
| Wedding ID & workspace | — | functions, vendors, tasks, timeline | confirm (via staff) | tasks + timeline seeded |
| Guests / RSVP | answer RSVP link | add guests; open each guest's RSVP link and share it by hand (no bulk send) | — | — |
| Documents | — | ❌ no upload | — | — |
| Event | — | run the day | deliver | — |
| Completion | — | mark completed | — | — |
| Review | (PR #150) review each booked vendor | publish / hide | — | — |

**The couple has two places, and only one works:**
- **Proposal link** `/proposal/[token]` — works (no login). Accept, request changes; PR #149 adds payments, PR #150 reviews.
- **Customer Portal** `/customer` (phone OTP) — shows the couple's wedding, approvals and guest list **only if
  `Wedding.customerId` is set. Nothing in the code ever sets it.** Live: 1 wedding, 0 with a customer. So the portal, customer
  approvals and couple-managed guests are unreachable for every real wedding.

---

## 5. Founder / admin

What the founder can see today (`/admin/dashboard`, "Today"): leads by stage, team performance, weddings coming up, money
due, overdue tasks, the CRM inbox. Missing (see gap analysis): commission and SaaS revenue, partner referrals, vendor response
waiting times, an audit trail of old → new values, one "needs attention" list across everything.

The admin sidebar shows **two generations of screens**: the new ones (Today, Leads & Quotes, Weddings, Vendors, Prospects,
Growth partners) and the old tabs (`/admin?tab=bookings|enquiries|consultations|leads|invoices|…`). The old tabs edit a
different status field from the CRM (section 6).

---

## 6. Status / state machines

| Object | Statuses | Who changes it | What follows | Reversible | Audited |
|---|---|---|---|---|---|
| **Lead / Enquiry / Consultation — CRM** | `pipelineStage`: NEW, CONTACTED, QUALIFIED, SITE_VISIT_SCHEDULED, QUOTATION_SENT, NEGOTIATION, ACCEPTED, WON, LOST, ON_HOLD | staff; automatic on quote sent / revised / accepted / booked | next-step chips, Command Center | forward only for automatic; Lost & Booked final | ✅ ActivityLog |
| **… — legacy** | `status` (Enquiry/Consultation: NEW, CONTACTED, CLOSED) | old admin tabs only | nothing | yes | ❌ |
| **Quotation** | DRAFT → SENT → ACCEPTED / REJECTED / EXPIRED / SUPERSEDED | staff; couple accepts on link; lazy expiry | booking, agreement, invoice | revise creates a new version; accepted is final | ✅ |
| **Booking** | NEW, CONTACTED, CONFIRMED, CLOSED | staff; auto-confirm at 25% (quotation bookings) | wedding created on CONFIRMED; WhatsApp to the customer on some updates | not checked | ✅ |
| **Agreement money** | NOT_STARTED → DATE_HELD (7 days) → CONFIRMED (derived, never stored) | payments | auto-confirm | overdue is flagged, nothing released | ✅ |
| **Invoice** | DRAFT → SENT → PARTIALLY_PAID → PAID (derived) | payments / issue | — | no void | ✅ |
| **Payment** | SUCCESS, FAILED, REFUNDED | staff / Razorpay webhook | invoice status, hold, confirm | no refund flow | ✅ |
| **PaymentSubmission** (PR #149) | PENDING → VERIFIED / REJECTED | couple submits, staff decide | VERIFIED records a Payment | no | ✅ |
| **Wedding** | PLANNING, ACTIVE (auto on first vendor confirmation), POSTPONED, COMPLETED, CANCELLED | staff | display stage (Planning / Final week / Wedding day / Completed) | Completed & Cancelled final | ✅ |
| **Vendor booking** | PENDING_VENDOR_CONFIRMATION, CONFIRMED, DECLINED, CUSTOMER_APPROVAL_PENDING, CANCELLED, COMPLETED | staff (vendor only `venueStatus`) | wedding ACTIVE, payouts | cancel / replace | ✅ |
| **Vendor enquiry** | PENDING, AVAILABLE, AVAILABLE_WITH_CONDITIONS, NOT_AVAILABLE, ALTERNATE_DATE, QUOTED, WITHDRAWN | vendor (Vendor OS) or staff | staff alert on not available | answer can change | ✅ |
| **Partner referral** | SUBMITTED, VERIFIED, CONTACTED, IN_DISCUSSION, CONVERTED, COMPLETED, PAID, REJECTED | staff, by hand | **nothing** (no CRM link) | yes | 🟡 |
| **Review** (PR #150) | PENDING → PUBLISHED / HIDDEN | couple submits, staff decide | vendor page | publish ⇄ hide | ✅ |
| **Notification** | model exists | only client-approval requests write one | **nothing reads or sends them** | — | — |

**Notifications:** none are sent by the system except WhatsApp on a new consultation (to admin + couple) and on some booking
updates, and OTP codes. Everything else ("send the proposal", "ask for reviews") is **copy a message and paste it into WhatsApp**.

---

## 7. Data ownership (who owns what)

- **Shaadi Shopping**: leads, enquiries, consultations, quotations, agreements, invoices, payments, weddings, commission, payouts,
  activity, partner programme, prospects.
- **Vendor**: profile, packages, photos, FAQs, availability, enquiry answers, venue hold status, `VendorCapability` (unused).
- **Couple**: their name/phone (inside Shaadi Shopping's records), guests and RSVPs, payment proofs (PR #149), reviews (PR #150).
- **Private / internal**: notes, stage, tasks, commission rates, payouts, vendor bank details (`VendorPaymentDetails`, encrypted,
  unused), proof screenshots (private Cloudinary).

For Vivah OS to work as "the venue's own system", a record would need an **owner** — Shaadi Shopping *or* a venue — and every
screen and API would need to respect it. That is the central architectural decision (gap analysis, blocker 1).
