# Vivah OS — Integration Test Matrix

*Started 22 Nov 2026. A permanent record of the end-to-end journeys we test, in order. Every PR that touches a journey adds or
updates its rows. [MASTER-PIPELINE-MATRIX.md](MASTER-PIPELINE-MATRIX.md) says which code performs each step; this file says
what we tested, how, and what happened.*

**Status:** ✅ pass · ❌ fail · 🟡 partly (works with a known gap) · ⬜ not yet tested · 🚧 not built.

**Where it was tested:**
- *local copy*: a restore of the nightly or on-demand encrypted backup (database `shaadi_fresh`), real data, never live.
- *staging*: the local staging database (`shaadi_staging`), with test venues and couples.
- *unit*: `bun test`.
- *db*: `bun run test:db` against an empty migrated database.

Browser checks drive headless Chrome over CDP at 1366 px (desktop) and 375 px (phone). For each one we record console errors,
HTTP errors, sideways scroll, clipped text and tap targets.

Always record the **database records affected** and the **permission** checked. Notifications are listed even when there are
none, so a missing one is visible.

---

## 1. Client onboarding and access

Enquiry → Consultation → Quotation → Acceptance → Booking → Wedding → Couple login → My Wedding

| # | Start | Action | Expected | Actual | Records | Permission | Notification | Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| 1.1 | Booking confirmed, wedding created | Couple opens their proposal link | A way into My Wedding | No mention of My Wedding on the link | — | public link | none | WED-2026-0002, 22 Nov | 🚧 (PR E) |
| 1.2 | Wedding exists, couple has no login | Staff give a sign-in code | Couple signs in and sees the wedding | Works, but only from the wedding page's sign-in card, by hand | `users.loginCodeHash` | staff | WhatsApp text copied by hand | live use | 🟡 |
| 1.3 | Couple signed in with the code they were given | Opens My Wedding | One "choose your own code" prompt | Two prompts (top and bottom) → fixed, one prompt | — | CUSTOMER | — | PR A screenshots | ✅ |

## 2. Quotation and booking

| # | Start | Action | Expected | Actual | Records | Permission | Notification | Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| 2.1 | Quotation revised | Couple opens the old link | Same link shows the new version | Old link dies; staff must send a new link | `quotations.customerTokenHash` | public link | none | code: `quotation.service.ts` revise | 🚧 (PR E) |
| 2.2 | Accepted quotation | Couple opens My Wedding → Documents | Quotation viewable and downloadable | Quotation QTN-202611-0005 prints on one A4 page, all 9 lines, discount and terms | read only | CUSTOMER (own wedding) | — | PR A: p1-print2.pdf | ✅ |

## 3. Payments and financial records

Booking → Payment schedule → Payment → Receipt → Invoice → Balance → Client dashboard

| # | Start | Action | Expected | Actual | Records | Permission | Notification | Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| 3.1 | WED-2026-0002: ₹85,500 agreed; 2 payments (₹15,000 + ₹6,375) | Couple opens My Wedding → Payments | Each payment listed with date, mode and amount; total = sum | 2 rows, total ₹21,375 = DB sum of SUCCESS payments | `payments` (2 rows, INV-202611-0001) | CUSTOMER | — | PR A: p1-desk.png | ✅ |
| 3.2 | Same | Couple taps "Receipt" on each payment | One A4 receipt per payment, with the balance as it stood | 2 receipts, 1 page each; the 2nd shows both payments and ₹64,125 due | read only | CUSTOMER | — | p1-print0/1.pdf | ✅ |
| 3.3 | Booking amount (25 %) fully paid, no instalment schedule | Couple looks at "Next" | Never the whole balance as the next instalment | Before: "Next ₹64,125". Now: "Booking amount paid; balance dates from your expert" | — | CUSTOMER | — | unit: `paymentPlan.test.ts` | ✅ |
| 3.4 | Booking amount part-paid | Couple looks at "Next" | Only the rest of the booking amount | `next = 16,375` (5,000 of 21,375 paid) | — | — | — | unit | ✅ |
| 3.5 | Invoice issued | Couple opens Documents → invoice | Viewable and downloadable; received and balance match | INV-202611-0001: ₹21,375, received ₹21,375, paid in full | read only | CUSTOMER | — | p1-print3.pdf | ✅ |
| 3.6 | WED-2026-0002, ₹64,125 balance, no schedule | Founder sets 2 instalments (₹40,000 by 27 Nov, ₹24,125 by 30 Nov) in the Money tab | Saved only if they add up to ₹64,125; couple sees both with dates; "Next" = ₹40,000 by 27 Nov | As expected. The live total read "matches the balance"; couple's Next: ₹40,000 · due by 27 Nov | `payment_instalments` (2), `commercial_agreements.scheduleVersion` 0→1, `activity_logs` (who and what) | SUPER_ADMIN full | none (couple sees it on next load) | local copy: s2-staff-after.png, s2-couple-phone.png | ✅ |
| 3.6a | Same | Save ₹1 short / ₹1 over / ₹125 short | Refused, nothing changed | 400 "₹125 is not scheduled"; db test: version unchanged | none | — | — | db: `payment.schedule.test.ts`, API | ✅ |
| 3.6b | Two staff edit the same schedule | Both save from version 0 at the same moment | Exactly one wins; the other gets "reload", never a mixed schedule | 1 ok, 1 ConflictError (row lock + version) | 1 set of instalments | — | — | db test | ✅ |
| 3.6c | Schedule set; ₹21,375 + ₹30,000 received | Staff and couple open money | Booking amount paid; 1st instalment ₹30,000 of ₹40,000; staff, couple and the agreement's outstanding all agree | Staff steps = couple steps; sum of remaining = `outstanding` (34,125) | `payments` (2) | — | — | db test | ✅ |
| 3.6d | Booking-made wedding, no coordinator | Assigned salesperson opens money / tries to change the schedule | Can read, cannot change | GET 200, PUT 403 "ask its coordinator or the founder" (after the #248 fix `1aaed2c`; before it: "none" on the wedding but "full" on the quote) | none | SALES (assigned) read | — | API on local copy; db: `money.access.booking.test.ts` | ✅ |
| 3.6e | Couple or no session | GET / PUT the schedule API | Refused | 401 / 401 | none | CUSTOMER, anonymous | — | API on local copy | ✅ |
| 3.6f | A venue business | Reads or changes Shaadi Shopping's schedule | Not found; unchanged | NotFound; count 0 in venue scope; schedule intact | none | other business | — | db test | ✅ |
| 3.7 | Couple pays by UPI from My Wedding | "I have paid" with the UTR | Claim recorded, staff verify, receipt appears | My Wedding only says "tell us on WhatsApp"; the UTR form is on the proposal link only | — | — | — | — | 🚧 (PR E) |
| 3.8 | Proposal link forwarded to a relative | Relative opens Payments | Payments private to the couple (decision 10 Nov, Q2 = A) | Payment history, UTRs and receipts visible without sign-in | — | public link | — | code: `PaymentsPanel` | ❌ (PR B/E) |

## 4. Functions and venue

| # | Start | Action | Expected | Actual | Records | Permission | Notification | Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| 4.1 | Wedding exists | Couple adds a function | Saved; "Waiting for confirmation" if at the venue; booking, price and hall unchanged | No add or edit for the couple | — | — | — | API list: `app/api/customer/*` | 🚧 (PR C) |

## 5. Vendors and services

| # | Start | Action | Expected | Actual | Records | Permission | Notification | Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| 5.1 | Wedding exists | Couple finds a vendor or adds their own | Marketplace and outside vendors clearly told apart; Ask for a Quote | Read-only list | — | — | — | — | 🚧 (PR D) |

## 6. Guest management and invitations

| # | Start | Action | Expected | Actual | Records | Permission | Notification | Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| 6.1 | Wedding exists | Couple adds a guest with side, family, VIP and one function; opens their RSVP link | Saved; RSVP shows only that function | Passed on staging 20 Nov (PR #237) | `guests`, `guest_function_responses` | CUSTOMER | none (links copied by hand) | #237 report | ✅ staging · ⬜ live |
| 6.2 | Guests added | Send invitations on WhatsApp, with reminders | — | Not built | — | — | — | — | 🚧 |

## 7. Travel and accommodation — 🚧 not built

## 8. Family access — 🚧 not built (one couple login per wedding)

---

### Edge cases to cover for every journey
- invalid data
- a cancelled action
- duplicate submission or double click
- a failed network request
- a permission violation
- concurrent edits
- changed dates or a cancelled booking
- a partial failure and its retry

A failed notification must never undo the business action.
