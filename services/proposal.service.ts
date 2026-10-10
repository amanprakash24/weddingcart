import { prisma } from '@/lib/prisma';
import { ActivityType } from '@/generated/prisma/enums';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { subjectCreateData } from '@/lib/crm/subject';
import { ONLINE_CHANNEL } from '@/lib/quotation/rules';
import {
  appendChangeNote,
  eventRequestNote,
  hashCustomerToken,
  isWellFormedToken,
  proposalState,
  toAddable,
  toCustomerProposal,
  validateChangeNote,
  validateEventRequest,
  type CustomerProposal,
} from '@/lib/quotation/proposal';
import { quotationRepository, type QuotationWithItems } from '@/repositories/quotation.repository';
import { activityLogRepository } from '@/repositories/activityLog.repository';
import { bookingSourceFacts, expireOverdue, quotationService } from '@/services/quotation.service';
import { applyCommercialEvent } from '@/services/leadStage.service';
import type { SourceType } from '@/services/leadInbox.service';
import { paymentSubmissionService, type ProofFile } from '@/services/paymentSubmission.service';
import type { ProposalPayments } from '@/lib/payments/customerPayment';
import { reviewService } from '@/services/review.service';
import type { ProposalReviews } from '@/lib/reviews/reviewView';
import { proposalBrandFor } from '@/lib/ownership/business';
import { FUNCTION_TYPE_LABELS, type Offering } from '@/lib/venue/offering';
import { loadAgreementMoney } from '@/services/agreement.service';
import { toCoupleBooking, type CoupleBookingWedding } from '@/lib/quotation/coupleBooking';

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
  payments: Pick<typeof paymentSubmissionService, 'forProposal' | 'submit'>;
  reviews: Pick<typeof reviewService, 'forProposal' | 'submit'>;
  brand: typeof proposalBrandFor;
  // The owning venue's "What we offer" list. BusinessOffering is not an owned table, so the business is always named here.
  offerings: (businessId: string) => Promise<Offering[]>;
  // "Your booking" on a business's own link: the agreement's money (Money v1, read-only) and the wedding the booking became.
  // Both run inside the business's scope (lib/quotation/proposalEntry.ts), so only that business's records can be read.
  money: typeof loadAgreementMoney;
  wedding: (id: string) => Promise<CoupleBookingWedding | null>;
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
  payments: paymentSubmissionService,
  reviews: reviewService,
  brand: proposalBrandFor,
  money: loadAgreementMoney,
  wedding: (id) =>
    prisma.wedding.findUnique({
      where: { id },
      select: { weddingNumber: true, status: true, primaryDate: true, events: { select: { type: true, label: true, date: true }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] } },
    }),
  offerings: (businessId) =>
    prisma.businessOffering.findMany({
      where: { businessId },
      select: { id: true, function: true, name: true, price: true, perPlate: true },
      orderBy: [{ function: 'asc' }, { createdAt: 'asc' }],
    }),
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
    const view = toCustomerProposal(q, source, vendorMap, now, {
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
    // D8: the business that owns this quotation — Shaadi Shopping, or the venue whose own customer this is.
    view.brand = await deps.brand(q.businessId);
    // The GST number the couple sees is the one frozen on THIS quotation (Quotation.sellerGstin), never today's business profile.
    if (!view.brand.isPlatform) view.brand = { ...view.brand, gstin: q.sellerGstin ?? null };
    // "Add an event": a venue's own open proposal shows what that venue offers. Shaadi Shopping has no such list.
    if (!view.brand.isPlatform && view.state === 'OPEN') view.addable = toAddable(await deps.offerings(q.businessId));
    // A business's own accepted proposal, once its booking is made: where the booking stands, what was received, and the wedding
    // it became. Read-only for the couple; a failure here never hides the proposal.
    if (q.status === 'ACCEPTED' && !view.brand.isPlatform) {
      try {
        const money = await deps.money(q.id, now);
        if (money.exists) view.yourBooking = toCoupleBooking(money, money.weddingId ? await deps.wedding(money.weddingId) : null, now);
      } catch (err) {
        console.error(`proposal booking for ${q.quotationNumber} could not be loaded —`, err instanceof Error ? err.message : err);
      }
    }
    // Roadmap 1.3: totals, receipts and "I have paid" — only once accepted. Read-only; a failure here never hides the proposal.
    // Shaadi Shopping's own quotations only: the UPI shown is Shaadi Shopping's and its staff verify each claim. A venue's own
    // customer pays the VENUE, so its link must never show this — the venue's own payee and its own verification come separately.
    if (q.status === 'ACCEPTED' && view.brand.isPlatform) {
      try {
        view.payments = await deps.payments.forProposal(q.id);
      } catch (err) {
        console.error(`proposal payments for ${q.quotationNumber} could not be loaded —`, err instanceof Error ? err.message : err);
      }
      // Roadmap 1.4: once the wedding is completed, the vendors they booked, to review. Same rule: never hides the proposal.
      try {
        view.reviews = await deps.reviews.forProposal(q.booking?.id, view.couple.name);
      } catch (err) {
        console.error(`proposal reviews for ${q.quotationNumber} could not be loaded —`, err instanceof Error ? err.message : err);
      }
    }
    return view;
  }

  // What "Request changes" and "Add an event" both do: keep the couple's words on the quotation, log them, and move the lead
  // Quotation Sent → Negotiation. The quotation's content, prices and status are NOT touched (decision D3).
  async function recordRequest(q: QuotationWithItems, text: string, summary: string): Promise<void> {
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
      await deps.logActivity({ type: ActivityType.QUOTATION_CHANGES_REQUESTED, summary, detail: text, ...subjectCreateData(sourceType, sourceId) }, tx);
      await deps.applyEvent(tx, sourceType, sourceId, 'CHANGES_REQUESTED', null);
    });
  }

  // A link the couple can still act on, or the same answers "Request changes" has always given.
  async function openProposal(token: unknown): Promise<QuotationWithItems> {
    const q = await resolve(token);
    if (!q) throw new ProposalNotFoundError();
    const state = proposalState(q, new Date());
    if (state !== 'OPEN') throw state === 'INVALID' ? new ProposalNotFoundError() : new ConflictError(state === 'ACCEPTED' ? 'This proposal has already been accepted' : 'This proposal has expired');
    return q;
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
    const q = await openProposal(token);
    await recordRequest(q, text, `The couple asked for changes on proposal ${q.quotationNumber} (revision ${q.revision})`);
    return { recorded: true };
  },

  // "Add an event": the couple asks the venue to add a function, optionally ticking what they want from the venue's own list.
  // Only ticks that really are on THIS venue's list for THAT function count — the names and prices written down are the venue's.
  async requestEvent(token: unknown, input: unknown): Promise<{ recorded: true }> {
    const wanted = validateEventRequest(input);
    const q = await openProposal(token);
    const offered = (await deps.brand(q.businessId)).isPlatform ? [] : (await deps.offerings(q.businessId)).filter((o) => o.function === wanted.function);
    if (offered.length === 0) throw new ValidationError('That function cannot be added here — please use "Request changes" instead');
    const picked = offered.filter((o) => wanted.offeringIds.includes(o.id));
    await recordRequest(
      q,
      eventRequestNote(wanted.function, picked, wanted.note),
      `The couple asked to add ${FUNCTION_TYPE_LABELS[wanted.function]} on proposal ${q.quotationNumber} (revision ${q.revision})`
    );
    return { recorded: true };
  },

  // "I have paid" (Roadmap 1.3, §20): only on an accepted proposal. Records a claim for staff to verify — never a payment.
  async submitPayment(token: unknown, raw: { amount: unknown; utr: unknown; paidOn?: unknown; note?: unknown }, proof: ProofFile | null): Promise<{ submitted: true; payments: ProposalPayments }> {
    const q = await resolve(token);
    if (!q) throw new ProposalNotFoundError();
    const state = proposalState(q, new Date());
    if (state === 'INVALID') throw new ProposalNotFoundError();
    if (state !== 'ACCEPTED') throw new ConflictError('Please accept the quotation before paying');
    // A venue's own customer pays the venue, not Shaadi Shopping (see customerView): nothing is recorded here for them.
    const brand = await deps.brand(q.businessId);
    if (!brand.isPlatform) throw new ConflictError(`Please contact ${brand.name} about your payment`);
    await deps.payments.submit(q, raw, proof);
    return { submitted: true, payments: await deps.payments.forProposal(q.id) };
  },

  // A review of one vendor the couple booked (Roadmap 1.4, §21) — only once their wedding is completed; staff publish it.
  async submitReview(token: unknown, vendorBookingId: unknown, raw: { rating: unknown; comment?: unknown; authorName?: unknown }): Promise<{ submitted: true; reviews: ProposalReviews | null }> {
    const q = await resolve(token);
    if (!q) throw new ProposalNotFoundError();
    const state = proposalState(q, new Date());
    if (state === 'INVALID') throw new ProposalNotFoundError();
    if (state !== 'ACCEPTED') throw new ConflictError('Reviews open once your wedding is completed');
    // Shaadi Shopping's own quotations only (see customerView): its staff publish each review; a venue's own link has no reviews.
    if (!(await deps.brand(q.businessId)).isPlatform) throw new ConflictError('Reviews are not available on this proposal');
    await deps.reviews.submit(q.booking?.id, vendorBookingId, raw);
    return { submitted: true, reviews: await deps.reviews.forProposal(q.booking?.id, typeof raw.authorName === 'string' ? raw.authorName : null) };
  },
  };
}

export const proposalService = createProposalService();
