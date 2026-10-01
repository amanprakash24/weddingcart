import { prisma } from '@/lib/prisma';
import { ActivityType } from '@/generated/prisma/enums';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { subjectCreateData } from '@/lib/crm/subject';
import { ONLINE_CHANNEL } from '@/lib/quotation/rules';
import {
  appendChangeNote,
  hashCustomerToken,
  isWellFormedToken,
  proposalState,
  toCustomerProposal,
  validateChangeNote,
  type CustomerProposal,
} from '@/lib/quotation/proposal';
import { quotationRepository, type QuotationWithItems } from '@/repositories/quotation.repository';
import { activityLogRepository } from '@/repositories/activityLog.repository';
import { bookingSourceFacts, expireOverdue, quotationService } from '@/services/quotation.service';
import { applyCommercialEvent } from '@/services/leadStage.service';
import type { SourceType } from '@/services/leadInbox.service';

// Wedding Proposal (docs/wedding-os/08-quotation.md §15) — what the couple can do through the secret link.
// A thin adapter: the token is resolved to ONE quotation revision, and every rule that matters is the existing
// quotation.service one (accept, createBooking) — nothing about quotations, bookings, agreements or invoices is
// re-implemented here. The couple is anonymous: actorId is always null, the channel is ONLINE.

// The single "not valid" answer for a missing, malformed, revoked, superseded, draft or rejected link — callers
// must never reveal which of those it was.
export class ProposalNotFoundError extends NotFoundError {
  constructor() {
    super('Proposal', 'link');
  }
}

function sourceOf(q: { enquiryId: string | null; consultationId: string | null; leadId: string | null }): { sourceType: SourceType; sourceId: string } {
  if (q.enquiryId) return { sourceType: 'ENQUIRY', sourceId: q.enquiryId };
  if (q.consultationId) return { sourceType: 'CONSULTATION', sourceId: q.consultationId };
  return { sourceType: 'LEAD', sourceId: q.leadId as string };
}

// Everything this service needs from the rest of the app, passed in explicitly. The app uses the real modules
// (defaultDeps); tests pass fakes — so no test ever mocks shared modules process-wide (Bun's mock.module would leak
// into other test files).
export interface ProposalDeps {
  db: Pick<typeof prisma, '$transaction'> & { vendor: Pick<typeof prisma.vendor, 'findMany'>; vendorBooking: Pick<typeof prisma.vendorBooking, 'findMany'> };
  findByTokenHash: typeof quotationRepository.findByCustomerTokenHash;
  findById: typeof quotationRepository.findById;
  expireOverdue: typeof expireOverdue;
  sourceFacts: typeof bookingSourceFacts;
  accept: typeof quotationService.accept;
  createBooking: typeof quotationService.createBooking;
  logActivity: typeof activityLogRepository.create;
  applyEvent: typeof applyCommercialEvent;
}

const defaultDeps = (): ProposalDeps => ({
  db: prisma,
  findByTokenHash: quotationRepository.findByCustomerTokenHash,
  findById: quotationRepository.findById,
  expireOverdue,
  sourceFacts: bookingSourceFacts,
  accept: (...a) => quotationService.accept(...a),
  createBooking: (...a) => quotationService.createBooking(...a),
  logActivity: activityLogRepository.create,
  applyEvent: applyCommercialEvent,
});

export function createProposalService(deps: ProposalDeps = defaultDeps()) {
  // Token → the quotation it belongs to, after applying the lazy expiry. null for anything that is not a live link.
  async function resolve(token: unknown): Promise<QuotationWithItems | null> {
    if (!isWellFormedToken(token)) return null;
    const hash = hashCustomerToken(token);
    const found = await deps.findByTokenHash(hash);
    if (!found) return null;
    await deps.expireOverdue({ id: found.id });
    return deps.findByTokenHash(hash);
  }

  async function customerView(q: QuotationWithItems, now: Date): Promise<CustomerProposal> {
    const { sourceType, sourceId } = sourceOf(q);
    const source = sourceType === 'LEAD' ? null : await deps.sourceFacts(sourceType, sourceId, prisma);
    // Linked vendors: only their PUBLIC profile fields (what their public page already shows) — never the owner's
    // contact details, bank details or anything commercial. toCustomerProposal then keeps profile details for
    // PUBLISHED vendors only.
    const vendorIds = [...new Set(q.items.map((i) => i.vendorId).filter((v): v is string => !!v))];
    const vendors = vendorIds.length
      ? await deps.db.vendor.findMany({
          where: { id: { in: vendorIds } },
          select: {
            id: true, name: true, slug: true, status: true, city: true, area: true, image: true, images: true, virtualTourVideo: true, description: true, features: true,
            guestCapacity: true, venueType: true, rating: true, reviewCount: true, category: { select: { name: true } },
          },
        })
      : [];
    const vendorMap = new Map(vendors.map((v) => [v.id, { ...v, category: v.category.name }]));

    // "Your confirmed vendors" (Step 7): once the couple accepted and the booking became a wedding — the CONFIRMED
    // vendor bookings on that wedding only; no prices are read.
    const bookingId = q.status === 'ACCEPTED' ? q.booking?.id : undefined;
    const confirmed = bookingId
      ? await deps.db.vendorBooking.findMany({
          where: { status: 'CONFIRMED', weddingEvent: { wedding: { sourceBookingId: bookingId } } },
          select: {
            vendor: { select: { name: true, category: { select: { name: true } } } },
            weddingEvent: { select: { type: true, label: true, date: true, venueName: true } },
          },
        })
      : [];
    return toCustomerProposal(q, source, vendorMap, now, {
      booked: q.booking?.status === 'CONFIRMED',
      confirmedVendors: confirmed.map((c) => ({
        vendorName: c.vendor.name,
        category: c.vendor.category.name,
        eventType: c.weddingEvent.type,
        eventLabel: c.weddingEvent.label,
        date: c.weddingEvent.date,
        venueName: c.weddingEvent.venueName,
      })),
    });
  }

  return {
  // The proposal page. Returns null for the generic "no longer valid" page. The first time a live proposal is
  // opened, customerViewedAt is set and one PROPOSAL_VIEWED entry is added to the CRM timeline (decision D6).
  // trackView is false for link-preview bots (WhatsApp etc. fetch the page when staff paste the link) — those
  // must not count as the couple opening it.
  async view(token: unknown, options: { trackView?: boolean } = {}): Promise<CustomerProposal | null> {
    const q = await resolve(token);
    if (!q) return null;
    const now = new Date();
    if (proposalState(q, now) === 'INVALID') return null;

    if (!q.customerViewedAt && options.trackView !== false) {
      await deps.db.$transaction(async (tx) => {
        // Conditional update: two first views at the same moment still record exactly one timeline entry.
        const first = await tx.quotation.updateMany({ where: { id: q.id, customerViewedAt: null }, data: { customerViewedAt: now } });
        if (first.count === 1) {
          const { sourceType, sourceId } = sourceOf(q);
          await deps.logActivity(
            {
              type: ActivityType.PROPOSAL_VIEWED,
              summary: `The couple opened proposal ${q.quotationNumber} (revision ${q.revision})`,
              ...subjectCreateData(sourceType, sourceId),
            },
            tx
          );
        }
      });
    }
    return customerView(q, now);
  },

  // Online acceptance. Idempotent: an already-accepted proposal answers "accepted" again without doing anything.
  // Acceptance goes through the SAME quotationService.accept staff use (channel ONLINE, no staff actor); the booking
  // is then attempted through the SAME createBooking. If the booking cannot be made yet (e.g. the enquiry has no clear
  // wedding date — decision C8), the acceptance still stands and staff finish the booking from the CRM.
  async accept(token: unknown): Promise<{ state: 'ACCEPTED'; bookingCreated: boolean; alreadyAccepted: boolean }> {
    const q = await resolve(token);
    if (!q) throw new ProposalNotFoundError();
    const state = proposalState(q, new Date());
    if (state === 'ACCEPTED') return { state: 'ACCEPTED', bookingCreated: false, alreadyAccepted: true };
    if (state !== 'OPEN') throw state === 'EXPIRED' ? new ConflictError('This proposal has expired') : new ProposalNotFoundError();

    try {
      await deps.accept(q.id, { channel: ONLINE_CHANNEL, note: `Accepted online by the couple through the proposal link (revision ${q.revision})` }, null);
    } catch (err) {
      // A double click / second tab racing on the row lock: the loser sees "already accepted", which is success.
      const now = await deps.findById(q.id);
      if (now?.status === 'ACCEPTED') return { state: 'ACCEPTED', bookingCreated: false, alreadyAccepted: true };
      throw err;
    }

    let bookingCreated = false;
    try {
      await deps.createBooking(q.id, {}, null);
      bookingCreated = true;
    } catch (err) {
      // Never an error for the couple: they HAVE accepted. The lead reads "Accepted — booking pending" and staff use the
      // existing Create booking action (which also covers a missing date or city). Duplicate bookings are impossible —
      // Booking.quotationId is unique and createBooking checks hasBooking under the lock.
      console.error(`proposal accept: booking for ${q.quotationNumber} left to staff —`, err instanceof Error ? err.message : err);
    }
    return { state: 'ACCEPTED', bookingCreated, alreadyAccepted: false };
  },

  // "Request changes": records the couple's note — the quotation's content, prices and status are NOT touched
  // (decision D3). The lead moves Quotation Sent → Negotiation; staff answer with a revision.
  async requestChanges(token: unknown, note: unknown): Promise<{ recorded: true }> {
    const text = validateChangeNote(note);
    const q = await resolve(token);
    if (!q) throw new ProposalNotFoundError();
    const state = proposalState(q, new Date());
    if (state !== 'OPEN') throw state === 'INVALID' ? new ProposalNotFoundError() : new ConflictError(state === 'ACCEPTED' ? 'This proposal has already been accepted' : 'This proposal has expired');

    const { sourceType, sourceId } = sourceOf(q);
    const now = new Date();
    await deps.db.$transaction(async (tx) => {
      const current = await tx.quotation.findUnique({ where: { id: q.id }, select: { changesRequestNote: true } });
      // Only while it is still SENT — a staff revision/acceptance in the meantime wins.
      const updated = await tx.quotation.updateMany({
        where: { id: q.id, status: 'SENT' },
        data: { changesRequestedAt: now, changesRequestNote: appendChangeNote(current?.changesRequestNote ?? null, text, now) },
      });
      if (updated.count !== 1) throw new ConflictError('This proposal was just updated — please reload the page');
      await deps.logActivity(
        {
          type: ActivityType.QUOTATION_CHANGES_REQUESTED,
          summary: `The couple asked for changes on proposal ${q.quotationNumber} (revision ${q.revision})`,
          detail: text,
          ...subjectCreateData(sourceType, sourceId),
        },
        tx
      );
      await deps.applyEvent(tx, sourceType, sourceId, 'CHANGES_REQUESTED', null);
    });
    return { recorded: true };
  },
  };
}

export const proposalService = createProposalService();
