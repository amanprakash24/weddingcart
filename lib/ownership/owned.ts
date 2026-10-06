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

// Records that belong to their business THROUGH a parent (§4.3, Phase B2): visible only when a parent chain leads to the current
// business; never created or re-pointed under another business's record.
export const CHILD_MODELS = [
  'ConsultationVendorSelection', 'BookingItem', 'InvoiceItem', 'QuotationItem', 'LeadInsight', 'Couple', 'WeddingEvent', 'Guest',
  'GuestFunctionResponse', 'VendorEnquiry', 'VendorBooking', 'TimelineMilestone', 'Document', 'Task', 'ActivityLog', 'ApprovalRequest',
  'PaymentLink', 'Payout', 'PaymentSubmission',
] as const;

export type ChildModel = (typeof CHILD_MODELS)[number];
export interface ParentLink {
  relation: string; // the relation field
  fk: string; // its foreign-key column
  model: OwnedModel | ChildModel;
}

const link = (relation: string, model: OwnedModel | ChildModel, fk = `${relation}Id`): ParentLink => ({ relation, fk, model });

// Every relation from an owned or child record to another owned or child record — kept equal to the schema by
// lib/ownership/guard.test.ts. Reading a child follows these links to its business; writing any record checks each linked id.
export const PARENT_LINKS: Record<OwnedModel | ChildModel, ParentLink[]> = {
  Lead: [],
  Consultation: [],
  Enquiry: [link('consultation', 'Consultation')],
  Quotation: [link('lead', 'Lead'), link('enquiry', 'Enquiry'), link('consultation', 'Consultation'), link('advanceInvoice', 'Invoice')],
  Booking: [link('enquiry', 'Enquiry'), link('consultation', 'Consultation'), link('quotation', 'Quotation')],
  CommercialAgreement: [link('quotation', 'Quotation'), link('booking', 'Booking')],
  Wedding: [link('sourceLead', 'Lead'), link('sourceEnquiry', 'Enquiry'), link('sourceConsultation', 'Consultation'), link('sourceBooking', 'Booking')],
  Invoice: [link('wedding', 'Wedding'), link('quotation', 'Quotation'), link('booking', 'Booking')],
  Payment: [link('invoice', 'Invoice')],
  ConsultationVendorSelection: [link('consultation', 'Consultation')],
  BookingItem: [link('booking', 'Booking')],
  InvoiceItem: [link('invoice', 'Invoice')],
  QuotationItem: [link('quotation', 'Quotation')],
  LeadInsight: [link('lead', 'Lead'), link('enquiry', 'Enquiry'), link('consultation', 'Consultation')],
  Couple: [link('wedding', 'Wedding')],
  WeddingEvent: [link('wedding', 'Wedding')],
  Guest: [link('wedding', 'Wedding')],
  GuestFunctionResponse: [link('guest', 'Guest'), link('weddingEvent', 'WeddingEvent')],
  VendorEnquiry: [link('lead', 'Lead'), link('enquiry', 'Enquiry'), link('consultation', 'Consultation'), link('quotation', 'Quotation')],
  VendorBooking: [link('weddingEvent', 'WeddingEvent')],
  TimelineMilestone: [link('wedding', 'Wedding')],
  Document: [link('wedding', 'Wedding'), link('vendorBooking', 'VendorBooking')],
  Task: [link('lead', 'Lead'), link('enquiry', 'Enquiry'), link('consultation', 'Consultation'), link('wedding', 'Wedding'), link('weddingEvent', 'WeddingEvent'), link('vendorBooking', 'VendorBooking')],
  ActivityLog: [link('lead', 'Lead'), link('enquiry', 'Enquiry'), link('consultation', 'Consultation'), link('wedding', 'Wedding'), link('vendorBooking', 'VendorBooking')],
  ApprovalRequest: [link('wedding', 'Wedding'), link('weddingEvent', 'WeddingEvent')],
  PaymentLink: [link('invoice', 'Invoice')],
  Payout: [link('vendorBooking', 'VendorBooking')],
  // The couple's "I have paid" claims (Roadmap 1.3) belong to the business whose quotation they are on.
  PaymentSubmission: [link('quotation', 'Quotation')],
};

// Links from a record to another record of the SAME model (a quotation revision, a milestone dependency). Checked on writes like
// any parent, but never followed when reading (a record's business comes from its other links).
export const SELF_LINKS: Partial<Record<OwnedModel | ChildModel, ParentLink[]>> = {
  Quotation: [link('supersedes', 'Quotation')],
  TimelineMilestone: [link('dependsOn', 'TimelineMilestone')],
};

// Every relation field (either direction) from an owned / child record to an OWNED record — kept equal to the schema by
// lib/ownership/children.test.ts. Nested writes through these are limited (lib/ownership/guard.ts: nestedOwnedWrite): only
// `connect` / `disconnect` on a forward link (a PARENT_LINKS / SELF_LINKS relation, whose id is then checked); never a nested
// create of an owned record, and nothing through a back-relation (which could pull another business's record onto this one).
export const OWNED_RELATIONS: Partial<Record<OwnedModel | ChildModel, string[]>> = {
  Lead: ['quotations', 'wedding'],
  Enquiry: ['quotations', 'wedding', 'bookings', 'consultation'],
  Consultation: ['quotations', 'wedding', 'bookings', 'enquiries'],
  Quotation: ['supersedes', 'supersededBy', 'lead', 'enquiry', 'consultation', 'advanceInvoice', 'invoices', 'booking', 'agreement'],
  Booking: ['enquiry', 'consultation', 'invoices', 'wedding', 'agreement', 'quotation'],
  CommercialAgreement: ['quotation', 'booking'],
  Wedding: ['sourceLead', 'sourceEnquiry', 'sourceConsultation', 'sourceBooking', 'invoices'],
  Invoice: ['wedding', 'payments', 'quotation', 'booking', 'advanceForQuotation'],
  Payment: ['invoice'],
  ConsultationVendorSelection: ['consultation'],
  BookingItem: ['booking'],
  InvoiceItem: ['invoice'],
  QuotationItem: ['quotation'],
  LeadInsight: ['lead', 'enquiry', 'consultation'],
  Couple: ['wedding'],
  WeddingEvent: ['wedding'],
  Guest: ['wedding'],
  VendorEnquiry: ['lead', 'enquiry', 'consultation', 'quotation'],
  TimelineMilestone: ['wedding'],
  Document: ['wedding'],
  Task: ['lead', 'enquiry', 'consultation', 'wedding'],
  ActivityLog: ['lead', 'enquiry', 'consultation', 'wedding'],
  ApprovalRequest: ['wedding'],
  PaymentLink: ['invoice'],
  PaymentSubmission: ['quotation'],
};
