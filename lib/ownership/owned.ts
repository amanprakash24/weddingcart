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
  'PaymentLink', 'Payout',
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
};
