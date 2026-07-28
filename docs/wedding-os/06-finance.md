# Finance — Functional Design

Company-wide money mechanics, built on the wedding-level and vendor-level views
already specified: `03-wedding-workspace.md` §6 (Budget Tracker) owns the
per-wedding view, `04-vendor-os.md` §6 (Earnings & Payouts) owns the per-vendor
view — this doc is where both connect to the business's actual books: what's owed,
what's collected, what's paid out, what's kept, and what GST compliance requires.

**Skipped ahead of `05-customer-portal.md` at your request — noted, not an
oversight.**

## 1. Purpose

Answer, reliably: how much money is owed to us, how much have we collected, how
much do we owe vendors, how much have we paid out, and how much have we actually
kept — with GST handled correctly and every number traceable to an individual
transaction, not a hand-maintained total.

## 2. Payments (customer-facing money in)

**Builds on real, already-migrated data**: `Invoice`/`InvoiceItem` already exist in
the Phase A schema, including GST-aware fields (`gstEnabled`, `gstAmount`) carried
over from the original Mongo model — this isn't new. What's missing is the
transaction history behind `Invoice.amountPaid`, which today is a single flat
number with no record of *when*, *how*, or *in how many installments* it was paid.

**New: individual `Payment` records** against an `Invoice` — amount, method, date,
gateway reference. **Razorpay is the already-decided payment gateway** (per the
finalized tech stack) — `Payment` should map to Razorpay's actual data shape
(`razorpayPaymentId`, `razorpayOrderId`, method, status) rather than an invented
generic structure, so reconciliation with Razorpay's own dashboard/webhooks is
direct, not a translation layer. Once individual `Payment` records exist,
`Invoice.amountPaid` should become **computed-on-read** (sum of its payments) —
the same pattern already used for `Category`'s vendor count and, per
`04-vendor-os.md`, `Vendor.rating`: a derived number that can silently drift from
its source is worse than recomputing it.

**Payment schedule/milestones** (advance / progress payments / final payment) ties
directly to `03-wedding-workspace.md` §6's planned/confirmed/paid/outstanding
breakdown — that section's numbers are this section's data, viewed per-wedding.

## 3. Vendor Payouts (money going out)

Builds on `04-vendor-os.md` §6's `Payout`/`Commission` entity — restated here from
the company side: for each `VendorBooking`, the vendor's net payout (price minus
commission) needs a payout method (bank transfer/UPI) and a payout record once sent.

**New gap this doc surfaces:** vendors need bank account or UPI details on file to
be paid — this doesn't exist on the `Vendor` model today. **Flag as
sensitive/regulated data** — should be encrypted at rest and access-restricted
(Founder/Finance role only, never exposed via any public-facing API), not stored
like an ordinary profile field.

**Payout batching:** does every vendor get paid individually per booking, or on a
cycle (weekly/monthly batch)? Restating `04-vendor-os.md`'s flag: **payout timing is
a business decision, not resolved by either doc** — but whichever is chosen, a
`PayoutBatch` grouping concept may be needed for reconciliation (matching one bank
transfer out to multiple vendor payouts it covers).

## 4. Commission & Revenue

Commission = `VendorBooking.price` × commission rate. **Rate is flagged as an open
business decision in `04-vendor-os.md` — restated, not resolved, here either.**
One additional question this doc adds: is the rate a single global number, or does
it vary by category or vendor tier (a premium venue vs. a small mehndi artist might
reasonably have different commission economics)? If it varies, that needs its own
small config concept (`CommissionRate` by category, defaulting to a global rate) —
flag as a decision, don't default to either shape without input.

**Revenue recognition** — when is commission counted as earned: at booking
confirmation, at customer payment, or at event completion? This affects which
month a given wedding's revenue shows up in. Flag as an accounting-policy decision
best made with whoever handles the books, not assumed here.

**Reporting:** total commission this month/by category/by city/trend over time —
this is the actual data source behind the Founder Dashboard's Revenue widget in
`01-command-center.md`.

## 5. GST & tax compliance

**This section describes what data needs to exist to support compliance — it does
not prescribe the actual tax treatment. GST structure for a marketplace/aggregator
model (vendor-charged GST vs. platform-charged GST on commission, e-commerce
operator obligations, any TCS requirements under GST law) is a real compliance
question with regulatory consequences and needs sign-off from a CA/tax advisor
before implementation, not an assumption baked into a product spec.**

What the data model likely needs to capture, for whatever structure the CA
confirms:
- **Vendor GSTIN** (if the vendor is GST-registered) — new field, doesn't exist on
  `Vendor` today
- **Invoice-level GST breakup** — already exists (`gstEnabled`/`gstAmount` on the
  current `Invoice` model)
- **Commission-invoicing structure** — platforms facilitating vendor services
  commonly need to issue their own GST-compliant document for the commission/service
  fee charged to vendors, separate from the vendor's own invoice to the customer —
  whether that applies here, and how, needs the same CA confirmation as above

## 6. Profit & reporting

**Scoped narrowly for v1**: gross margin = commission revenue collected − vendor
payouts made. This is **not** a full P&L (no operating costs, salaries, marketing
spend) — flag full P&L as a future enhancement, not this doc's scope, since
conflating "platform gross margin" with "is the company profitable" would be
misleading if presented as the same number.

**Reports:** revenue by month/city/category, outstanding customer payments (feeds
`01-command-center.md`'s Founder/Operations "Outstanding Payments" widgets),
outstanding vendor payouts, commission trend.

## 7. What this doc does not cover (explicitly out of scope, not forgotten)

- **Refunds/cancellations** — what happens financially when a wedding or a single
  vendor booking is cancelled after payment has occurred. Real gap, not addressed
  here — needs its own pass once cancellation policy itself is defined (a business
  decision, not a technical one).
- **Full P&L** (operating costs, salaries, marketing) — see §6.

---

## Data model gaps

| Concept | First named in | Detail here |
|---|---|---|
| `Payment` (individual records) | `03-wedding-workspace.md` (as "Payment/PaymentSchedule") | Finalized: maps to Razorpay's payment shape; `Invoice.amountPaid` becomes computed-on-read from these |
| `Payout`/`Commission` | `01-command-center.md`, `04-vendor-os.md` | Restated: commission rate and payout timing still open business decisions |
| Vendor bank/UPI details | **New, this doc** | Sensitive — encrypt at rest, restrict access to Founder/Finance role |
| `PayoutBatch` | **New, this doc** | Only needed if payouts are cyclical/batched rather than per-booking — depends on the payout-timing decision |
| `CommissionRate` config (if rate varies) | **New, this doc** | Only needed if commission isn't a single global number — flagged, not decided |
| Vendor GSTIN | **New, this doc** | Pending CA confirmation of actual GST structure |
| Refund handling | **New, this doc, explicitly out of scope for v1** | Needs cancellation policy defined first |

## Relationship to other modules

- **From `03-wedding-workspace.md`** §6: this doc is where "paid"/"outstanding" at
  the wedding level roll up into company-wide numbers.
- **From `04-vendor-os.md`** §6: this doc is the company-side reconciliation of
  vendor-side earnings/payouts.
- **To `01-command-center.md`**: Founder Dashboard's Revenue and Outstanding
  Payments widgets, and Operations Dashboard's Payment Reminders widget, are all
  powered by this doc's data.

## Future enhancements

- Automated reconciliation via Razorpay webhooks (payment status updates without manual entry)
- Full P&L including operating costs
- Refund/cancellation money-flow, once cancellation policy is defined
