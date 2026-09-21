# Commercial flow V1 — from enquiry to invoice

Status: implemented on branch `feat/commercial-flow-v1` (not merged). Read with `09-wedding-v1-model.md` (the wedding side).

```
Lead → Consultation → Quotation → Negotiation → Revised quotation(s) → Final quotation
     → Customer acceptance → Booking confirmed → Invoice → Payment / advance → Wedding planning
```

Advance and payment come **after** Booking Confirmed (decision, 21 Sep 2026): confirming creates the wedding and its advance
invoice; the advance is collected through the wedding.

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
