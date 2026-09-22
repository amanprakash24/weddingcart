# Commercial flow V1 — from enquiry to invoice

Status: implemented on branch `feat/commercial-flow-v1` (not merged). Read with `09-wedding-v1-model.md` (the wedding side).

```
Lead → Consultation → Quotation → Negotiation → Revised quotation(s) → Final quotation
     → Customer acceptance → Booking confirmed → Invoice → Payment / advance → Wedding planning
```

> **Superseded on 22 Sep 2026 by Money V1 (see the last section).** The 21 Sep decision was: advance and payment come *after*
> Booking Confirmed. The founder's rule is the reverse: a booking is confirmed only once **25% of the accepted quotation total** has
> been received; a smaller payment only *holds the date* for 7 days. The rest of this document (quotation versions, one agreement,
> invoice lifecycle, terms) is unchanged.

~~Advance and payment come **after** Booking Confirmed (decision, 21 Sep 2026): confirming creates the wedding and its advance
invoice; the advance is collected through the wedding.~~

## The rules

1. **Quotation versions are unchanged.** A revision creates a new draft (revision + 1) copying prices and terms; the sent
   original becomes SUPERSEDED; nothing is deleted. A superseded quotation can't be accepted, edited, revised or sent. A revision
   must be given a fresh valid-until date before it is sent.
2. **Acceptance applies to the current version, and is final.** The accepted quotation holds the line items, quantities, prices,
   discount, tax, total, advance and Terms & Conditions. An accepted quotation cannot be revised (a post-acceptance change is a
   future change-order workflow, not V1).
3. **The booking is made from the accepted quotation** (`Booking.quotationId`, unique — one booking per quotation). Its total and
   lines come from that quotation.
4. **Every invoice belongs to the accepted agreement.** `Invoice.quotationId` (+ `bookingId` on the booking path, `kind`
   ADVANCE / BALANCE / OTHER). At most one ADVANCE and one BALANCE invoice per quotation (unique index). The accepted quotation is
   immutable, so its lines, discount, tax, total, advance and terms are read *through* that relation instead of being copied;
   nothing that later changes (a venue's defaults, a setting) can alter what was agreed.
5. **No invoice from an old quotation.** The advance invoice is created only from an ACCEPTED quotation; the balance invoice is
   created server-side from the wedding's accepted quotation with no client-supplied amount.

## Lead stage follows the commercial facts

`PipelineStage` gains **ACCEPTED** ("Accepted — booking pending"); WON already displays as **Booked**. Automatic moves
(`lib/crm/stageEvents.ts`, applied by `services/leadStage.service.ts`):

| Event | Stage becomes |
|---|---|
| quotation sent | Quotation Sent |
| quotation revised | Negotiation |
| customer acceptance recorded | Accepted — booking pending |
| booking confirmed / wedding created | Booked (WON) |

Forward only. Lost and Booked are final. Accepted and Booked cannot be picked by hand. A lead whose stage lagged behind
(e.g. still New after a quote was sent — how every lead behaved before) is caught up by the next event.

## Terms & Conditions

`Vendor.defaultTerms` (edited in the vendor form). Creating a quotation **copies** the venue's default into it (the first
venue-category line with default terms; text typed for the quotation wins). A revision copies the *previous quotation's* terms.
An accepted quotation's terms are its own frozen text. Changing a venue's default later never changes an existing quotation,
booking or invoice.

## Invoice lifecycle

`DRAFT → SENT → PARTIALLY_PAID → PAID` (`lib/invoice/lifecycle.ts`). Status is derived from what happened — issued? how much
received? — never guessed. **SENT** is set by "Mark as issued" or by creating a payment link (the fix for invoices that stayed
DRAFT forever). **PARTIALLY_PAID / PAID** follow payments, whether a Razorpay webhook or a manually recorded payment. There is no
void/cancel in the schema, and none was invented.

## Wedding → Money is the invoice workflow

From the wedding: see what was agreed (quotation number, total / advance / balance, lines, accepted terms), view invoices, issue a
draft, generate a payment link, record a cash / UPI / bank-transfer / cheque payment (never more than the balance), create the
balance invoice. The old `/admin?tab=invoices` screen remains a list of standalone invoices; creating one for a customer who
already has a wedding now asks first (`409 HAS_WEDDING`, override with `confirmStandalone`).

## Schema changes (`20260921120000_commercial_flow_v1`)

Additive only: `PipelineStage.ACCEPTED`, `InvoiceStatus.PARTIALLY_PAID`, `InvoiceKind` enum, `invoices.kind / quotationId /
bookingId / issuedAt` (+ FKs, indexes, unique `(quotationId, kind)`), `vendors.defaultTerms`. Backfills: existing automatic
advance invoices are linked to their quotation/booking and marked ADVANCE; an invoice that already had a payment link or payment
becomes SENT.

## Not in V1

Change orders after acceptance; a customer-facing quotation page or e-signature; a void/cancel invoice; per-line tax; a
venue-terms picker inside the quotation editor (the venue's default is copied when the quotation is created); a one-off script to
re-stage leads created before this change.

## Money V1 — the 25% confirmation rule (22 Sep 2026)

```
Accepted quotation → Booking created → part payment (Date Held) → 25% received → Booking Confirmed → Wedding created → Planning
```

Quote Accepted ≠ Booking Confirmed, and Date Held ≠ Booking Confirmed. Vendor confirmation never confirms the booking and never changes
the wedding stage.

**The rules live in one place** — `lib/commercial/rules.ts`: 25% (`confirmationPercent`), 7 days (`holdWindowDays`), rounded **up** to the
rupee. No Settings screen in V1; nothing else may hard-code them. `Quotation.advanceAmount` no longer decides what is required.

**The agreement snapshot** (`CommercialAgreement`, one per accepted quotation, made when the booking is created; a CRM quotation with no
booking gets it lazily on its first payment or first confirmation attempt). It freezes: quotation id + revision, the customer's name and
phone, the total / subtotal / discount / tax, the rule it was made under and the exact confirmation amount, the accepted items (with their
**quotation-item ids**) and function labels, the accepted terms, and who accepted it and when. It stores **no money that moves** —
received / remaining / Date Held / Confirmed are derived from the payments — so there is one source of truth. It keeps only operational
timestamps: `holdStartedAt` / `holdExpiresAt` (set once, by the first payment) and `confirmedAt`. A later change to a venue's default
terms, a vendor price, a quotation default or the rule never re-prices a deal already made. (No T&C *version* exists in the product, so
the frozen text itself is the record; there is no unit-of-measure on a quotation line, so none is stored.)

**Invoices.** The advance invoice (`kind=ADVANCE`) is now created **with the booking**, for exactly the confirmation amount, linked to the
quotation and the booking, with no wedding yet. When the booking is confirmed and the wedding created, that same invoice — with every
payment on it — is attached to the wedding (no second invoice, nothing copied). The balance invoice is total − confirmation amount.
Uniqueness (`(quotationId, kind)`, `Quotation.advanceInvoiceId`) is unchanged.

**Payments** (staff-recorded cash / UPI / bank transfer / cheque; no Razorpay). A payment is applied to the advance invoice first and the
rest to the balance invoice, so **25% is a minimum, not a maximum**, and every invoice stays exact. One receipt may therefore be two
payment rows (shared `receiptId`). Each payment records its reference (UTR), who recorded it, and an idempotency key (a double-submitted
form is recorded once; the same UTR twice on one agreement is refused). Serialised on the agreement, so two people can never together
exceed what is owed. The first payment starts the 7-day hold; it never restarts.

**The gate** (server-side, never a checkbox): a booking made from an accepted quotation cannot become CONFIRMED — and neither the booking
path nor the CRM lead-conversion path can create a wedding — until received ≥ the confirmation amount. Below it the server refuses with
"₹30,000 more required to confirm this booking." and creates nothing. On the booking path the booking confirms itself (and the wedding
is created by the existing, idempotent conversion) the moment the payment that reaches the amount is recorded; a failure there never
undoes the payment, and the ordinary "Confirm booking" button is the retry. A CRM lead has no booking, so it becomes "ready" and staff
create the wedding.

**After 7 days** without reaching 25%: the booking stays Date Held and is flagged **overdue**. Nothing is released, cancelled or refunded
automatically; a person decides. A later payment still counts, and reaching 25% then confirms the booking as normal.

**Left exactly as it was:** a booking with no quotation (marketplace checkout); a booking made before this rule (no agreement — its
advance invoice is still made at conversion, from the quotation's own advance, unchanged). No historical record is rewritten.

**Not in V1:** refunds, forfeits, cancellation after payment, change orders after acceptance, customer-submitted payments and proof,
a payment-verification workflow, a Settings screen for the rules, and vendor payouts (unchanged, still in the Functions tab).
