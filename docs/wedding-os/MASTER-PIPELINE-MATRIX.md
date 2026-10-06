# Vivah OS — Master Pipeline Matrix

*Audit of 3 Oct 2026, main = `69b3f70`. Every business transition, with the code that performs it. Read with
[MASTER-SYSTEM-FLOW.md](MASTER-SYSTEM-FLOW.md).*

**Status:** ✅ works and is connected · 🟡 partly (works, but a step is manual or a piece is missing) · ❌ missing · 🔴 broken
(exists but the connection does not happen) · ⏳ built, not merged (PR #149 / #150 / local branch).

**Test:** *unit* = `bun test` (runs locally, **no CI exists**); *db* = `tests-db/` against a real Postgres (skipped unless a test
database is configured — not run in this audit); *golden* = `tests-db/golden-wedding.test.ts` (16-step staff-side wedding).
No UI / browser end-to-end test exists for any flow.

**Live use** (read-only, 3 Oct): 30 consultations, 2 enquiries, 0 leads, 1 quotation (draft), 8 cart bookings (all closed),
1 wedding (ACTIVE), 1 vendor booking, 0 payments, 0 vendor enquiries, 0 guests, 0 documents, 2 growth partners, 0 referrals,
1 vendor login.

## A. Capture — enquiries come in

| From | Action | To | API | Database | UI | Role | Status | Test |
|---|---|---|---|---|---|---|---|---|
| Website visitor | Popup / contact form | **Lead** | `POST /api/leads` | `leads` | homepage popups | public | ✅ | — |
| Vendor page visitor | "Enquire" | **Enquiry** (about one vendor) | `POST /api/enquiries` | `enquiries` | vendor pages | public | ✅ | unit: `api/enquiries/*`, `enquiry.service*` |
| `/plan` wizard | Plan my wedding | **Consultation** (+ WhatsApp to admin & couple) | `POST /api/consultations` | `consultations` | `/plan` | public | ✅ | unit: `api/consultations/*`, `consultation.service` |
| Cart | Checkout | **Booking** (marketplace, no quote) | `POST /api/bookings` | `bookings`, `booking_items` | `/cart` | public | ✅ | unit: `api/bookings/*`, `booking.service` |
| **Venue / vendor** | Add own enquiry (phone, walk-in, WhatsApp, Instagram…) | their own lead | — | — | — | VENDOR | ❌ | — |
| Staff | Add an enquiry by hand (phone call) | Lead / Consultation | — (only public forms; the CRM has no "add") | — | — | staff | ❌ | — |
| Staff | Create a booking by hand (from a vendor package) | Booking NEW | `POST /api/bookings` | `bookings` | old Bookings tab | staff | 🟡 old screen, marketplace-style | unit: `api/bookings/*` |
| Growth Partner | Refer a couple / vendor | **PartnerReferral** | `POST /api/growth-partner/referrals` | `partner_referrals` | `/growth-partner` | partner (code) | ✅ | unit: `growthPartner.*` |
| PartnerReferral | → CRM lead | Lead / Consultation | — | no link column | — | staff | ❌ | — |

## B. CRM — sales

| From | Action | To | API | Database | UI | Role | Status | Test |
|---|---|---|---|---|---|---|---|---|
| Lead / Enquiry / Consultation | appear in one inbox | CRM row | `GET /api/crm/leads` | 3 tables, `leadInbox.service` | `/admin/crm` | staff | ✅ | unit: `lib/crm/*` |
| CRM row | Assign | owner | `POST …/[type]/[id]/assign` | `assignedToId`, ActivityLog | lead workspace | staff | ✅ | unit |
| CRM row | Follow-up task / note | Task, ActivityLog | `…/tasks`, `…/notes` | `tasks`, `activity_logs` | lead workspace | staff | ✅ | unit |
| CRM row | Move stage | `pipelineStage` | `…/stage` | `pipelineStage` | lead workspace | staff | ✅ | unit: `pipeline`, `leadJourney` |
| Old admin tab | Change status | legacy `status` | `PUT /api/consultations/[id]`, `/api/enquiries/[id]`, `/api/bookings/[id]` | `status` only | `/admin?tab=…` | staff | 🔴 **two states** — never synced with `pipelineStage` (live: 17 consultations CLOSED but stage NEW) | — |
| Lead → Consultation | chain | — | — | — | — | — | by decision none (three parallel tables) | — |
| Consultation | Pick vendors | ConsultationVendorSelection | `POST /api/crm/consultations/[id]/vendor-selections` | `consultation_vendor_selections` | lead workspace | staff | ✅ | unit: `consultationVendorSelection.service` |
| Selection / quote line | Ask vendor | **VendorEnquiry** | (automatic on save) | `vendor_enquiries` | — | system | ✅ (0 live) | unit: `vendorEnquiry.*` |
| VendorEnquiry | Vendor answers | answer + staff alert | `POST /api/vendor/enquiries/[id]` | `vendor_enquiries`, ActivityLog | `/vendor/enquiries` | VENDOR | ✅ | unit |
| VendorEnquiry | Staff record answer | answer | `POST /api/crm/vendor-enquiries/[id]/answer` | same | lead workspace | staff | ✅ | unit |

## C. Proposal → quotation → approval

| From | Action | To | API | Database | UI | Role | Status | Test |
|---|---|---|---|---|---|---|---|---|
| CRM row | Create quotation | Quotation DRAFT | `POST /api/quotations` | `quotations`, `quotation_items` | lead workspace | staff | ✅ | unit + db: `quotation.*` |
| Quotation | Send | SENT, stage → Quotation Sent | `POST /api/quotations/[id]/send` | status, ActivityLog | lead workspace | staff | ✅ | unit + golden 4 |
| Quotation | Create proposal link | token hash | `POST /api/quotations/[id]/customer-link` | `customerTokenHash` | CustomerLinkBox | staff | ✅ (link copied into WhatsApp by hand) | unit |
| Proposal link | Couple opens | first view logged | `/proposal/[token]` | `customerViewedAt`, ActivityLog | proposal page | couple | ✅ | unit: `proposalViewGate`, `proposal.service` |
| Proposal | View detailed quotation | — | same page `#quotation` | — | proposal page | couple | ✅ (1.2) | unit: `proposalPage` |
| Couple | Request changes | note, stage → Negotiation | `POST /api/proposal/[token]/request-changes` | `changesRequest*` | proposal page | couple | ✅ | unit |
| Quotation | Revise | new version, old SUPERSEDED | `POST /api/quotations/[id]/revise` | `supersedesId` | lead workspace | staff | ✅ | unit + db |
| Couple | Accept | ACCEPTED + booking | `POST /api/proposal/[token]/accept` | status, `bookings` | proposal page | couple | ✅ | unit |
| Staff | Record acceptance (WhatsApp yes) | ACCEPTED | `POST /api/quotations/[id]/accept` | same | lead workspace | staff | ✅ | golden 5 |
| Quotation | Reject | REJECTED | `POST /api/quotations/[id]/reject` | status | lead workspace | staff | ✅ | unit |

## D. Booking, money, Wedding ID

| From | Action | To | API | Database | UI | Role | Status | Test |
|---|---|---|---|---|---|---|---|---|
| Accepted quotation | Create booking | Booking + **Agreement** + advance invoice (25%) | `POST /api/quotations/[id]/create-booking` (also automatic on online accept) | `bookings`, `commercial_agreements`, `invoices` | lead workspace | staff / system | ✅ | unit + golden 6 |
| Agreement | Record payment (cash/UPI/bank/cheque) | Payment(s), hold, invoice status | `POST /api/quotations/[id]/payments` | `payments`, `invoices` | Money card | staff | ✅ (0 live) | db: `money.v1` |
| Payment ≥ 25% | Auto-confirm | Booking CONFIRMED → **Wedding** | (inside the payment) | `weddings`, events, vendor bookings, tasks, timeline | — | system | ✅ | golden 6b–7 |
| Payment < 25% | Hold the date | DATE_HELD, 7 days | (derived) | `holdStartedAt/ExpiresAt` | Money card | system | ✅ (overdue = flag only) | unit: `commercial/rules` |
| CRM lead, ready | Create wedding | **Wedding** | `POST /api/crm/leads/[type]/[id]/convert` | `weddings` | ConvertToWeddingDialog | staff | ✅ | unit + db |
| Cart booking | Confirm | Wedding | `PATCH /api/bookings/[id]` | `weddings` | old Bookings tab | staff | 🟡 old screen, outside the CRM | unit |
| Couple | Pay by UPI + "I have paid" | PaymentSubmission | `POST /api/proposal/[token]/payments` | `payment_submissions` | Payments tab | couple | ⏳ #149 | unit |
| PaymentSubmission | Verify / reject | Payment (via Money v1) | `POST …/payment-submissions/[id]/verify|reject` | `payments` | Money card | staff | ⏳ #149 | unit |
| Invoice | Razorpay payment link | PaymentLink | `POST /api/weddings/[id]/invoices/[id]/payment-link` | `payment_links` | wedding Money tab | staff | ✅ (needs live keys; 0 live) | unit + golden 10–11 |
| Razorpay | Webhook | Payment | `POST /api/payments/webhook` | `payments` | — | system | ✅ | unit + golden 11 |
| Payment | Receipt | receipt data | `GET …/payments/[id]/receipt` | — | — (JSON only) | staff | 🟡 (no couple-facing receipt on main; #149 adds one) | — |
| Booking → Wedding | **link the couple's login** | `Wedding.customerId` | — | **never written** | — | — | 🔴 Customer Portal empty for every wedding (live: 0 of 1) | — |

## E. Wedding operations

| From | Action | To | API | Database | UI | Role | Status | Test |
|---|---|---|---|---|---|---|---|---|
| Wedding | Add / edit function | WeddingEvent | `…/functions`, `…/functions/[id]` | `wedding_events` | Functions tab | staff | ✅ | unit + db: `functions.services` |
| Wedding | Add vendor booking | VendorBooking | `POST /api/weddings/[id]/vendor-bookings` | `vendor_bookings` | Functions tab | staff | ✅ | unit |
| VendorBooking | Confirm / decline | status; wedding → ACTIVE | `PATCH …/vendor-bookings/[vbId]` | status | Functions tab | **staff** | 🟡 vendor cannot accept/decline themselves | golden 13 |
| VendorBooking | Venue hold status | `venueStatus` | `PATCH /api/vendor/bookings/[id]` | `venueStatus` | `/vendor` | VENDOR | ✅ | unit: `venuePortal.service` |
| VendorBooking | Cancel / replace / re-price | new booking | `…/cancel`, `…/replace` | `vendor_bookings` | Functions tab | staff | ✅ | db |
| Wedding | Tasks | Task | `…/tasks` | `tasks` | Plan tab | staff | ✅ | unit: `planTasks` |
| Wedding | Timeline milestones | Milestone | `PATCH …/milestones/[id]` | `timeline_milestones` | Plan tab | staff | ✅ | unit |
| Wedding | Guests | Guest + RSVP token | `…/guests` | `guests` | People tab | staff | ✅ (0 live) | — |
| Guest | RSVP | responses | `PATCH /api/rsvp/[token]` | `guest_function_responses` | `/rsvp/[token]` | guest | ✅ (link shared by hand) | — |
| Couple | Manage own guests | Guest | `/api/customer/weddings/[id]/guests` | `guests` | Customer Portal | CUSTOMER | 🔴 needs `Wedding.customerId` | — |
| Wedding | Client approval request | ApprovalRequest + Notification | `…/approvals` | `approval_requests`, `notifications` | wedding | staff | 🟡 notification written, never delivered | — |
| Couple | Approve / reject | decision | `/api/customer/approvals/[id]` | same | Customer Portal | CUSTOMER | 🔴 needs `Wedding.customerId` | — |
| Wedding | Documents | Document | — (no upload route) | `documents` | Files tab (read-only) | — | ❌ | — |
| VendorBooking | Vendor payout | Payout | `…/vendor-bookings/[vbId]/payout`, `PATCH …/payouts/[id]` | `payouts` | Money tab | staff | ✅ manual PENDING→PAID | unit: `payout.service` |
| Wedding | Mark completed | COMPLETED | `PATCH /api/weddings/[id]/status` | status, `completedAt` | Overview | staff | ✅ | db: `wedding.completion` |

## F. After the wedding

| From | Action | To | API | Database | UI | Role | Status | Test |
|---|---|---|---|---|---|---|---|---|
| Completed wedding | Couple reviews each booked vendor | Review PENDING | `POST /api/proposal/[token]/reviews` | `reviews` | Reviews tab | couple | ⏳ #150 | unit |
| Review | Publish / hide | vendor page | `PATCH /api/weddings/[id]/reviews/[id]` | `reviews.status` | wedding Overview | staff | ⏳ #150 | unit |
| Staff | Ask for reviews | WhatsApp message (copied) | — | — | wedding Overview | staff | ⏳ #150 | — |

## G. Growth Partner

| From | Action | To | API | Database | UI | Role | Status | Test |
|---|---|---|---|---|---|---|---|---|
| Visitor | Register (partner code issued at once) | GrowthPartner (NEW) + code | `POST /api/growth-partner/register` | `growth_partners` | `/growth-partner` | public | ✅ | unit |
| Staff | Approve partner | APPROVED | `PATCH /api/admin/growth-partners/[id]` | same | `/admin/growth-partners` | staff | ✅ | unit |
| Partner | Submit referral | PartnerReferral SUBMITTED | `POST /api/growth-partner/referrals` | `partner_referrals` | `/growth-partner` | partner | ✅ | unit |
| Referral | Verify → contact → convert → complete | status | `PATCH /api/admin/growth-partner-referrals/[id]` | status only | admin | staff | 🟡 manual, no link to the lead / wedding it became | unit |
| Referral | Payout | `payoutStatus`, amount typed by staff | same | same | admin | staff | 🟡 no money record (not a Payment / Payout) | unit |

## H. Vendor onboarding and login

| From | Action | To | API | Database | UI | Role | Status | Test |
|---|---|---|---|---|---|---|---|---|
| Vendor | Apply | VendorApplication | `POST /api/vendor-applications` | `vendor_applications` | `/vendor-onboarding` | public | ✅ | unit |
| Staff | Approve | Vendor + VendorProfile (login) | `PATCH /api/vendor-applications/[id]` | `vendors`, `vendor_profiles` | old tab "Vendor applications" | staff | ✅ | unit |
| Vendor | Log in by OTP | session | NextAuth `otp` provider, `/api/otp/send` | `otps` | `/vendor/login` | VENDOR | ✅ (1 live) | unit: `api/otp/send` |
| Staff | Outreach to prospects | VendorProspect status | `/api/vendor-prospects/*` | `vendor_prospects` | `/admin/vendor-prospects` | staff | ✅ (576 live) | unit |
