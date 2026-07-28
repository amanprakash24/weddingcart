# Customer Portal — Functional Design

The last doc in the first-pass Wedding OS specification, deliberately written after
`07-ai-assistant.md` so its AI surface (§4 below) was already mapped rather than
retrofitted. Gives couples visibility into their own wedding — the same underlying
data as `03-wedding-workspace.md`, scoped and reframed for a customer audience, not
a second data store.

## 1. Purpose

Reduce reliance on "checking WhatsApp to know what's happening" — the same
principle already stated for the internal Task Board in
`03-wedding-workspace.md` §8, extended to the couple themselves. Self-service where
it genuinely helps (viewing status, making a payment); everything else stays
read-only with a clear path to contact their coordinator.

## 2. Relationship to the Wedding Workspace — one dataset, two views

The Customer Portal is **not** a separate data store. It's the `CUSTOMER`-role,
own-wedding-scoped view of the same `Wedding`/`WeddingEvent`/`VendorBooking`/
`Payment`/`Task`/`Document`/`ActivityLog` entities `03-wedding-workspace.md`
specified — served through the same Milestone 2 repository pattern with
permission scoping (role=`CUSTOMER`, filtered to `weddingId = self`), not a
parallel implementation. Where Operations sees the full internal detail, the
customer sees a filtered subset — the filtering rules are specified per section
below, not left implicit.

## 3. Sections

### My Wedding Overview
Read-only version of `03-wedding-workspace.md` §1: status, countdown, budget
summary, coordinator contact info. Same 60-second-understanding principle as the
internal Overview, aimed at the couple instead of the team.

### Timeline
Read view of §3's milestone timeline. Customers can comment/ask questions on a
milestone (feeds the Communication section below) but don't edit status —
status changes stay a coordinator action.

### Vendor Directory (for this wedding)
Read view of §5's vendor assignments: which vendor is booked for which service/
event, contact info, package details.

**Open UX decision, flagged not assumed:** does the customer *choose* the vendor
from options the coordinator proposes, or does the coordinator book directly and
the customer is simply informed? Given the platform's positioning (emotion-first,
coordinator-led planning around the couple's budget/preferences — not a
self-service browse-and-book marketplace) a "coordinator proposes, customer
approves" flow seems more aligned than pure self-service, but this is a real
product decision, not a technical one — flag for the founder rather than assume.
If approval is required, `VendorBooking` likely needs a `CUSTOMER_APPROVAL_PENDING`
sub-state alongside the vendor-side `PENDING_VENDOR_CONFIRMATION` already specified
in `04-vendor-os.md` §4.

### Payments
View invoices and payment schedule (from `06-finance.md` §2); **make a payment** —
the one clearly actionable, self-service feature in this doc, going through the
same Razorpay integration already decided for `06-finance.md`. A customer-initiated
payment creates a `Payment` record against their `Invoice`, identical in shape to
one entered by Operations — same entity, different actor.

### Budget
Customer-facing budget summary — **must explicitly exclude vendor commission/
margin data**. Internal Operations sees `VendorBooking.price` and the commission
taken from it (`06-finance.md` §4); the customer should see what they're paying,
not the platform's margin on each line item. This is an access-control/filtering
rule on read, not a separate stored value — flag clearly so it isn't accidentally
exposed via a shared API response shape down the line.

### Documents
View/download their own documents (contracts, invoices, receipts) from
`03-wedding-workspace.md` §7. **Requires a visibility flag on `Document`** — some
documents (internal vendor negotiation notes, cost-basis paperwork) must never be
customer-visible; today's `Document` gap definition in §7 of that doc didn't yet
specify an audience field, added here.

### Communication
View their own communication history (their side of the `ActivityLog`/
`Communication` timeline from `03-wedding-workspace.md` §9), and send a message/
question to their coordinator — a customer-initiated entry in the same unified
timeline, not a separate inbox.

## 4. AI features (already mapped in `07-ai-assistant.md`, consumed here)

Not re-derived — this doc's job is to expose what was already specified:

| Feature | Level | Where it surfaces here |
|---|---|---|
| Recommend vendors | 2 | Vendor Directory, when a service isn't yet booked |
| Build a wedding timeline | 1 | Timeline section, as an editable starting suggestion |
| Estimate budgets | 1 | My Wedding Overview / Budget — built on the already-real `EST_RANGES` data noted in `07-ai-assistant.md` §2 |
| Answer planning questions | 1 | Communication section, as a first-response layer before a human coordinator sees the question |

Per `07-ai-assistant.md` §3's guardrails: none of these send anything on the
platform's behalf without the coordinator's visibility — an AI-answered planning
question is still logged in the shared Communication timeline, not a private
side-channel invisible to the team.

## 5. Auth

No new mechanism needed — `CUSTOMER` is already a `Role` enum value from
Milestone 1, with phone+OTP login already designed in `lib/auth/auth.ts` (Phase A,
not yet wired to a live UI). What's needed: a link from a `CUSTOMER`-role `User` to
their `Wedding` — following the same pattern as the existing `User.vendorId`
field, not a new auth flow. A customer could plausibly have more than one wedding
over time (unlikely but shouldn't be hardcoded as impossible) — worth a
one-to-many relationship, not a single `weddingId` foreign key on `User`.

## 6. Data model gaps

| Concept | Detail |
|---|---|
| `Document.visibility`/audience flag | New — internal-only vs. customer-visible, needed before any Document is exposed through this portal |
| `User` ↔ `Wedding` link | One-to-many (a customer could have multiple weddings over time), following the existing `User.vendorId` pattern |
| `CUSTOMER_APPROVAL_PENDING` on `VendorBooking` | Only if the "coordinator proposes, customer approves" UX (§3) is the chosen direction — flagged, not decided |
| Budget-view filtering rule | Not a new entity — an access-control rule ensuring commission/margin data never reaches a customer-facing response, called out so it isn't missed when building the shared API |

## 7. Relationship to other modules

Built entirely on top of already-specified modules, nothing net-new at the
architecture level: `03-wedding-workspace.md` (the underlying data), `06-finance.md`
(payments), `04-vendor-os.md` (read-only vendor info, and the approval-flow
question above), `07-ai-assistant.md` (the Customer AI row, consumed not
redesigned).

## 8. Future enhancements

- Guest list management + RSVP tracking (already flagged as a future item in
  `03-wedding-workspace.md`, belongs here on the customer-facing side when it happens)
- Mobile app / push notifications for timeline and payment reminders
- Photo/memory sharing post-event (outside this doc's scope, noted for later)

---

## First-pass Wedding OS specification: complete

With this doc, all 7 modules named in Part 3 have a first-pass functional design:
`01-command-center.md`, `02-crm.md`, `03-wedding-workspace.md`, `04-vendor-os.md`,
`05-customer-portal.md`, `06-finance.md`, `07-ai-assistant.md`. Every doc's "data
model gaps" section is the collected input for the Phase B schema design — that's
the next real decision point, not implementation of any of this yet.
