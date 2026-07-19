# Track B: Booking → Wedding Conversion Pipeline (Implementation Prep)

Not implementation of a production feature — preparation, per the explicit
instruction not to change production behavior while the Postgres migration is
still paused on staging. Nothing here is wired into any live route. This is the
exact pipeline prioritized as "the first Wedding OS implementation," built ahead
of time so it's ready the moment the migration platform is proven:

```
Booking (CONFIRMED) → Wedding → WeddingEvent → VendorBooking → Tasks → ActivityLog
```

## What's here

**Repositories** (`repositories/`), following `docs/repository-contract.md`'s
standard interface, with two deliberate deviations explained inline rather than
silently applied:
- `booking.repository.ts` — minimal (`findById`, `update` only). The existing
  Mongo-backed `/api/bookings` route owns full CRUD; this repository exists only
  to serve the conversion pipeline.
- `activityLog.repository.ts` — no `update`/`delete`. `ActivityLog` is
  append-only by design (no `updatedAt` in the schema either) — enforced by
  omission at this layer, not left to caller discipline.
- `wedding.repository.ts`, `weddingEvent.repository.ts`,
  `vendorBooking.repository.ts`, `task.repository.ts` — full standard interface.

**Service**: `services/weddingConversion.service.ts`, exporting
`convertBookingToWedding(bookingId)`. Transactional (one `prisma.$transaction`
wraps the whole conversion, per the contract's "services own transactions" rule),
idempotent (checks `Wedding.sourceBookingId` first — re-running against an
already-converted booking returns the existing `Wedding`, doesn't duplicate or error).

## Business rules enforced (in the service, not the repository, per the contract)

- Only a `CONFIRMED` booking can convert — anything else throws
  `InvalidBookingStateError`.
- A booking with no `weddingDate` (a historical row predating that field) cannot
  convert until a coordinator backfills it — not silently defaulted.
- Per `docs/wedding-os/step4-workflow-review.md`'s resolved finding: a
  `BookingItem` with a null `vendorId` (vendor removed since) is skipped, logged
  to `ActivityLog`, and flagged with a `HIGH`-priority `Task` for manual
  resolution — rather than erroring the whole conversion or silently dropping
  the line item.

## Deliberately excluded from this pass

**Invoice/Payment creation is not included** — the prioritized pipeline diagram
stopped at `ActivityLog`, and whether/when an `Invoice` gets auto-created on
conversion is still the open question from `docs/wedding-os/schema-draft-1-notes.md`,
not resolved here. Extending this pipeline to also create an `Invoice` is the
natural next piece once that question is answered.

## Verification

`tsc --noEmit`, lint, and a full `next build` all pass clean — no regressions to
any existing route. Cannot be executed end-to-end yet (no live Postgres instance),
same constraint as `scripts/migrate-to-postgres.mjs`.
