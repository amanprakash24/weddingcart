# Wedding V1 — Product Model (implementation specification)

Status: **model agreed in chat 2026-09-21; implementation not started.** This extends
`03-wedding-workspace.md` (which describes what the workspace holds) and `05-customer-portal.md`
(the couple's view). It does not replace them. It fixes the *mental model* and the *vocabulary* that
those screens must follow.

Why it exists: the Wedding Workspace had grown into one long admin page (10 anchor links, a status
dropdown as its loudest control, "Active" / "Healthy" chips) that a non-technical venue owner could
not read in 10 seconds. That is a product problem, not a styling problem.

The test every screen must pass: **within 10 seconds a Patna banquet-hall owner can say where they
are, what the wedding is, what is happening, and what to do next.**

## 1. One Wedding, many views

There is exactly ONE `Wedding` record. Each role gets a different *view* of it — never a separate
Wedding, never a copy.

| Role | View name (UI) | Route today | Scope |
|---|---|---|---|
| Admin / Founder | **Wedding Workspace** (staff) | `/admin/weddings/[id]` | Everything |
| Couple | **My Wedding** | `/customer` | Their wedding, client-safe fields only |
| Venue owner | **Wedding Booking** | `/vendor` | Only their own booking(s) within the wedding |
| Vendor (photo, catering…) | **Service Workspace** | `/vendor` | Only their own service booking |
| Guest | **Wedding Home** | `/rsvp/[token]` (RSVP only today) | Public-safe schedule + their RSVP — **V2** |

Rules:

- Permissions and data visibility stay role-specific.
- **Never pass the full admin workspace object to a customer, venue, vendor or guest surface.** Each
  view is built through an explicit allow-list (the pattern `clientPortal.service.ts` already uses for
  activity types). New fields are invisible to non-admin roles until someone adds them on purpose.

## 2. Two lifecycles — never one status

### Sales / commercial (already built; three separate facts)

```
Lead → Quote → Customer Accepted → Booking Pending → BOOKING CONFIRMED
                                                          │ creates the Wedding
                                                          ▼
                                       Wedding → Invoice → Payment / Advance → wedding execution
```

Quote status, lead stage and booking status stay three independent facts (`lib/crm/leadJourney.ts`).
When the Booking is confirmed the commercial milestone is reached and the Wedding exists.

## Locked decisions (founder, 2026-09-21)

1. **Advance/payment stays AFTER Booking Confirmed in V1.** Flow: Quote Accepted → Booking Confirmed →
   Wedding → Invoice → Payment/Advance → Wedding execution. (Matches the code and the 2026-09-20
   decision: the advance is a DRAFT invoice created with the Wedding and collected through it —
   `Invoice.weddingId`; Razorpay links only work for wedding-linked invoices.)
2. **Advance payment is NOT a prerequisite for Booking Confirmed.** No payment gate, and Razorpay /
   payment behaviour is not rewired by this restructuring.
3. **Vendor confirmation does NOT determine the wedding's operational stage.** `PLANNING` and `ACTIVE`
   read the same (Planning); only the calendar moves a wedding on.
4. **A valid vendorless / venue-only wedding can reach Completed.** Zero confirmed vendors is fine.
5. **Postpone / Cancel normally disappear once the wedding reaches Wedding day.** Wedding day is the
   primary state on that date. A same-day cancellation stays a controlled exception to be built
   later — no exception workflow in V1.
6. **Completion is an operational action**, not dependent on vendor confirmation or payment
   completion. Open tasks, unpaid money and unconfirmed vendors are warnings, not blockers. The only
   hard rule is the calendar: not before the wedding's last day.

### Wedding / operations (this spec)

```
BOOKING CONFIRMED → PLANNING → FINAL WEEK → WEDDING DAY → COMPLETED
                      │  exceptions: POSTPONED, CANCELLED
```

- "Wedding Active" is **not** a user-facing state. The word is retired.
- The wedding starts in **Planning** the moment the Booking is confirmed.

### Mapping to what is stored (no schema change in V1)

`WeddingStatus` today: `PLANNING | ACTIVE | POSTPONED | COMPLETED | CANCELLED`. `ACTIVE` currently
only means "first vendor booking confirmed" (`maybeActivateWedding`).

| Shown stage | Derived from |
|---|---|
| **Planning** | status `PLANNING` **or** `ACTIVE`, and the date is more than 7 days away |
| **Final week** | status `PLANNING`/`ACTIVE`, date within the next 7 days |
| **Wedding day** | status `PLANNING`/`ACTIVE`, date is today |
| **Completed** | status `COMPLETED` |
| **Postponed** / **Cancelled** | status `POSTPONED` / `CANCELLED` (shown as a banner, not a stage) |

Stage is **computed for display**, in one pure, unit-tested function (`lib/wedding/stage.ts`, same
style as `leadJourney.ts`). Nothing new is stored. "Date passed but not completed" surfaces as a
prompt to close the wedding, not as another stage.

**Closing a wedding (decided).** `COMPLETED` used to be reachable only from `ACTIVE`, and
`PLANNING → ACTIVE` fires on the first vendor confirmation, so a vendorless wedding could never be
completed. Resolved by allowing `PLANNING → COMPLETED` in `lib/wedding/lifecycle.ts`. The status API
requires the wedding's last day to have arrived for that new path (`ACTIVE → COMPLETED` is unchanged).
No new status, no schema change.

**Postpone / cancel on the day (decided).** Not offered from Wedding day onward — see
`canPostponeOrCancel` in `lib/wedding/stage.ts`. (The stored transition matrix itself still permits
`ACTIVE → POSTPONED/CANCELLED`; the screen simply does not offer it. Enforcing it server-side belongs
to the controlled same-day exception, later.)

## 3. What every wedding screen must answer

1. **One sentence:** couple · date · venue/city · guests · stage.
2. **One next action**, chosen by priority: pending vendor confirmation → send draft advance invoice →
   collect unpaid advance → assign coordinator → missing couple names → first open task. (Same pattern
   as the Lead Workspace "Next action".)
3. **Three facts:** money (quoted / advance due or paid), venue confirmation, date.
4. A link back to the quote and lead the wedding came from.

## 4. Vocabulary

| Use | Do not use |
|---|---|
| **Lead** (source shown as "Website enquiry", "Consultation request") | Enquiry/Consultation as competing headings |
| **Quote** | Quotation (customer-facing) |
| **Booking** / "Booking confirmed" | "Final Booking" |
| **Wedding** | Event (for the wedding itself) |
| **Function** — one occasion in the wedding (Mehendi, Sangeet…) | Event, WeddingEvent (UI) |
| **Service** — venue, photography, catering; status *Awaiting vendor / Confirmed* | "Vendor Booking" (UI) |
| **Couple** | Client/Customer (UI) |
| **Wedding Workspace / My Wedding / Wedding Booking / Service Workspace / Wedding Home** | Control Room, Event workspace, Client Portal |
| **Planning / Final week / Wedding day / Completed** | Active |

"Event" is reserved for the public events pages (`/admin/events`).

## 5. Wedding Workspace (staff) — structure

Replace 10 anchor links with **6 tabs**: **Overview · Plan** (tasks, timeline, approvals) **· Functions
& vendors · Money · People** (couple, guests/RSVP) **· Files & history**.

Do not show on first screen: the `WED-…` number as title, "From CRM/From Booking", Health and Status
chips together, the status dropdown (Postpone/Cancel move under "More"), empty sections (collapse to
one "Add …" prompt), raw enum values.

## 6. V1 vs V2

**V1 (no schema change):** `lib/wedding/stage.ts` + next-action logic; header and Overview redesign;
6 tabs; vocabulary above; source link; advance shown as "Advance due"; couple view reordered to
"what needs you → what's next → money"; venue view scoped to its booking.

**V2:** Guest Wedding Home (needs a public token and dress-code/notes fields — additive), a fuller
Vendor Workspace, completion guard, manual payments, notifications, function CRUD beyond the first.

## 7. Implementation order (each step: implement → test → verify in a browser → fix → PASS → next)

1. `lib/wedding/stage.ts` + tests (pure).
2. Header + Overview (sentence, next action, three facts).
3. 6-tab structure and vocabulary.
4. Money summary (advance visible).
5. Couple view ("My Wedding").
6. Venue view ("Wedding Booking").

Nothing is DONE from code and tests alone — the screen must also be understandable to a
non-technical user.
