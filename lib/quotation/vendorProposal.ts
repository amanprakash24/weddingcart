// Vendor Proposal View — the part of an ACCEPTED quotation that belongs to one vendor
// (docs/wedding-os/04-vendor-os.md "Proposal view"; 08-quotation.md §15 D4). Pure: no database.
//
// Like the couple's proposal (lib/quotation/proposal.ts) this is NOT a separate model — it is a read-only projection
// of the Quotation. The vendor's lines are filtered by vendorId in the database query itself (services/
// vendorProposal.service.ts); this file then builds the view from an explicit allow-list, so nothing else — other
// vendors, quotation totals, discount, tax, terms, notes, the couple's contact details, acceptance or CRM details —
// can ever reach the vendor, even by accident.
import type { BookingSource } from '@/lib/quotation/booking';

// ACCEPTED = the couple accepted; this is when the vendor's access begins. BOOKED = that accepted proposal has
// progressed to a booking; access simply continues. BOOKED is a label, never a condition for access.
export type VendorProposalStatus = 'ACCEPTED' | 'BOOKED';

// The vendor's own lines, as selected from the database (already filtered to this vendor).
export interface VendorProposalLineInput {
  vendorId: string | null; // used only to re-check ownership below — never output
  sortOrder: number;
  description: string;
  category: string | null;
  functionLabel: string | null;
  unitPrice: number;
  quantity: number;
}

// A function (wedding event) this vendor is booked for — only once a wedding exists. Same fields the existing
// Vendor OS already shows for an assigned event (services/venuePortal.service.ts).
export interface VendorProposalEventInput {
  type: string;
  label: string | null;
  date: Date;
  startTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  city: string;
}

export interface VendorProposalInput {
  id: string;
  quotationNumber: string;
  revision: number;
  items: VendorProposalLineInput[];
  booking: {
    status: string;
    wedding: { weddingNumber: string; primaryDate: Date; city: string; guestCount: number | null; weddingType: string | null; events: VendorProposalEventInput[] } | null;
  } | null;
}

export interface VendorProposalLine {
  category: string | null;
  functionLabel: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface VendorProposal {
  id: string; // the quotation id — the vendor reaches it only through their own list; access is re-checked on every read
  number: string;
  version: number;
  status: VendorProposalStatus;
  wedding: { name: string | null; date: string | null; guestCount: number | null; city: string | null; eventType: string | null };
  lines: VendorProposalLine[];
  total: number; // the sum of THIS vendor's line totals — the agreed amount for their quoted work
  venue: { function: string; date: string; startTime: string | null; venueName: string | null; venueAddress: string | null; city: string }[];
}

export type VendorProposalSummary = Pick<VendorProposal, 'id' | 'number' | 'version' | 'status' | 'wedding' | 'total'> & { lineCount: number };

export function vendorProposalStatus(booking: VendorProposalInput['booking']): VendorProposalStatus {
  return booking ? 'BOOKED' : 'ACCEPTED';
}

// `vendorId` is the logged-in vendor (from the session, never from the request). The query already returns only their
// lines; they are filtered again here so a future change to the query can never put another vendor's line on screen.
export function toVendorProposal(
  q: VendorProposalInput,
  vendorId: string,
  source: Pick<BookingSource, 'name' | 'city' | 'dateText' | 'guestCount' | 'eventType'> | null
): VendorProposal {
  const lines = q.items
    .filter((i) => i.vendorId === vendorId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => ({
      category: i.category,
      functionLabel: i.functionLabel,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.unitPrice * i.quantity,
    }));
  const wedding = q.booking?.wedding ?? null;
  return {
    id: q.id,
    number: q.quotationNumber,
    version: q.revision,
    status: vendorProposalStatus(q.booking),
    wedding: {
      name: source?.name ?? null,
      // Once the wedding exists its date/guests/city are the confirmed ones; before that, what the enquiry said.
      date: wedding ? wedding.primaryDate.toISOString() : source?.dateText ?? null,
      guestCount: wedding?.guestCount ?? source?.guestCount ?? null,
      city: wedding?.city ?? source?.city ?? null,
      eventType: wedding?.weddingType ?? source?.eventType ?? null,
    },
    lines,
    total: lines.reduce((sum, l) => sum + l.lineTotal, 0),
    venue: (wedding?.events ?? []).map((e) => ({
      function: e.label || e.type,
      date: e.date.toISOString(),
      startTime: e.startTime,
      venueName: e.venueName,
      venueAddress: e.venueAddress,
      city: e.city,
    })),
  };
}

export function toVendorProposalSummary(p: VendorProposal): VendorProposalSummary {
  return { id: p.id, number: p.number, version: p.version, status: p.status, wedding: p.wedding, total: p.total, lineCount: p.lines.length };
}
