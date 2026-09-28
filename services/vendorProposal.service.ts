// Vendor Proposal View (docs/wedding-os/04-vendor-os.md "Proposal view") — read-only.
//
// Isolation is enforced HERE, not in the UI:
//  1. The vendor is always the logged-in user's own vendor (vendorForUser) — never an id from the URL, query or body.
//  2. The database query itself only matches quotations that contain at least one line of that vendor, and only
//     selects that vendor's lines — other vendors' lines are never read.
//  3. Only ACCEPTED quotations (the couple said yes) whose deal is still going ahead; anything else — draft, sent,
//     expired, rejected, superseded, unknown id, another vendor's quotation — is the same generic "not found".
//  4. The view is built from an explicit allow-list (toVendorProposal) — no database object is passed through.
// Nothing here writes to the database.
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { toVendorProposal, toVendorProposalSummary, type VendorProposal, type VendorProposalInput, type VendorProposalSummary } from '@/lib/quotation/vendorProposal';
import type { BookingSource } from '@/lib/quotation/booking';
import type { SourceType } from '@/services/leadInbox.service';
import { bookingSourceFacts } from '@/services/quotation.service';
import { vendorForUser } from '@/services/venuePortal.service';

// One message for every "you can't see this" case, so a vendor can't tell a real quotation from a made-up id.
export class VendorProposalNotFoundError extends NotFoundError {
  constructor() {
    super('Proposal', 'unavailable');
  }
}

const MAX_LIST = 100;

// Which quotations a vendor may see, as a database filter. Exported so the tests can assert the rule itself.
export function vendorVisibleWhere(vendorId: string, quotationId?: string) {
  return {
    ...(quotationId ? { id: quotationId } : {}),
    status: 'ACCEPTED' as const,
    items: { some: { vendorId } },
    // A deal that stopped after acceptance (booking closed, or the enquiry marked lost / not proceeding) is no
    // longer an accepted proposal for the vendor to work from.
    NOT: { booking: { is: { status: 'CLOSED' as const } } },
    AND: [
      { OR: [{ leadId: null }, { lead: { is: { pipelineStage: { not: 'LOST' as const } } } }] },
      { OR: [{ enquiryId: null }, { enquiry: { is: { pipelineStage: { not: 'LOST' as const } } } }] },
      { OR: [{ consultationId: null }, { consultation: { is: { pipelineStage: { not: 'LOST' as const } } } }] },
    ],
  };
}

// Exactly what is read — this vendor's lines only, and venue details only for functions this vendor is booked for
// (the same rule the existing Vendor OS uses). Source ids are read to look up the couple's facts, never output.
export function vendorProposalSelect(vendorId: string) {
  return {
    id: true,
    quotationNumber: true,
    revision: true,
    leadId: true,
    enquiryId: true,
    consultationId: true,
    items: {
      where: { vendorId },
      orderBy: { sortOrder: 'asc' as const },
      select: { vendorId: true, sortOrder: true, description: true, category: true, functionLabel: true, unitPrice: true, quantity: true },
    },
    booking: {
      select: {
        status: true,
        wedding: {
          select: {
            weddingNumber: true,
            primaryDate: true,
            city: true,
            guestCount: true,
            weddingType: true,
            events: {
              where: { vendorBookings: { some: { vendorId } } },
              orderBy: { date: 'asc' as const },
              select: { type: true, label: true, date: true, startTime: true, venueName: true, venueAddress: true, city: true },
            },
          },
        },
      },
    },
  };
}

type Row = VendorProposalInput & { leadId: string | null; enquiryId: string | null; consultationId: string | null };
type FindArgs = { where: ReturnType<typeof vendorVisibleWhere>; select: ReturnType<typeof vendorProposalSelect> };

export interface VendorProposalDeps {
  findMany: (args: FindArgs & { orderBy: { acceptedAt: 'desc' }; take: number }) => Promise<Row[]>;
  findFirst: (args: FindArgs) => Promise<Row | null>;
  vendorIdForUser: (userId: string) => Promise<string>;
  sourceFacts: (sourceType: SourceType, sourceId: string) => Promise<BookingSource>;
}

function defaultDeps(): VendorProposalDeps {
  return {
    findMany: (args) => prisma.quotation.findMany(args) as unknown as Promise<Row[]>,
    findFirst: (args) => prisma.quotation.findFirst(args) as unknown as Promise<Row | null>,
    vendorIdForUser: async (userId) => (await vendorForUser(userId)).vendorId,
    sourceFacts: (sourceType, sourceId) => bookingSourceFacts(sourceType, sourceId, prisma),
  };
}

export function createVendorProposalService(deps: VendorProposalDeps = defaultDeps()) {
  // The couple's name / date / guests / city from the enquiry or consultation (the phone it also returns is dropped
  // by toVendorProposal). A lead-sourced quotation has no such facts; a missing source is not an error for the vendor.
  async function facts(row: Row) {
    const source: { sourceType: SourceType; sourceId: string } | null = row.enquiryId
      ? { sourceType: 'ENQUIRY', sourceId: row.enquiryId }
      : row.consultationId
        ? { sourceType: 'CONSULTATION', sourceId: row.consultationId }
        : null;
    if (!source) return null;
    try {
      return await deps.sourceFacts(source.sourceType, source.sourceId);
    } catch {
      return null;
    }
  }

  function project(row: Row, vendorId: string, source: Awaited<ReturnType<typeof facts>>): VendorProposal {
    // Only the allow-listed input fields are handed on — not the row itself.
    return toVendorProposal({ id: row.id, quotationNumber: row.quotationNumber, revision: row.revision, items: row.items, booking: row.booking }, vendorId, source);
  }

  return {
    // The vendor's accepted proposals, newest acceptance first. A user without a vendor profile gets NotFoundError.
    async listForVendor(userId: string): Promise<VendorProposalSummary[]> {
      const vendorId = await deps.vendorIdForUser(userId);
      const rows = await deps.findMany({ where: vendorVisibleWhere(vendorId), select: vendorProposalSelect(vendorId), orderBy: { acceptedAt: 'desc' }, take: MAX_LIST });
      const proposals = await Promise.all(rows.map(async (row) => project(row, vendorId, await facts(row))));
      return proposals.filter((p) => p.lines.length > 0).map(toVendorProposalSummary);
    },

    // One proposal. Anything the vendor may not see → VendorProposalNotFoundError (same for every reason).
    async getForVendor(userId: string, quotationId: unknown): Promise<VendorProposal> {
      const vendorId = await deps.vendorIdForUser(userId);
      if (typeof quotationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(quotationId)) throw new VendorProposalNotFoundError();
      const row = await deps.findFirst({ where: vendorVisibleWhere(vendorId, quotationId), select: vendorProposalSelect(vendorId) });
      const proposal = row ? project(row, vendorId, await facts(row)) : null;
      if (!proposal || proposal.lines.length === 0) throw new VendorProposalNotFoundError();
      return proposal;
    },
  };
}

export const vendorProposalService = createVendorProposalService();
