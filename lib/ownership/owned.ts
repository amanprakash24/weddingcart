// Record ownership (docs/wedding-os/15-record-ownership.md, approved 4 Oct 2026). Pure.
//
// The records that carry their owner directly (§4.3). Everything else (lines, events, guests, tasks, activity …) is reached only
// through one of these, so it inherits the owner. Phase B scopes every query on these tables by the logged-in business, and a CI
// scan fails on an unscoped one.

// The platform business — Shaadi Shopping itself. Created by migration 20261004120000_add_business_ownership; every record that
// existed before ownership belongs to it.
export const PLATFORM_BUSINESS_ID = 'shaadi-shopping';

export const OWNED_MODELS = [
  'Lead',
  'Enquiry',
  'Consultation',
  'Quotation',
  'Booking',
  'CommercialAgreement',
  'Wedding',
  'Invoice',
  'Payment',
] as const;

export type OwnedModel = (typeof OWNED_MODELS)[number];
