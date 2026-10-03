import { ActivityType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { REVIEWABLE_BOOKING, validateReview } from '@/lib/reviews/rules';
import { reviewSummary, toPublicReview, type ProposalReviews, type PublicReview } from '@/lib/reviews/reviewView';
import { resolveUserNames } from '@/lib/users';
import { activityLogRepository } from '@/repositories/activityLog.repository';

// Roadmap 1.4 (docs/wedding-os/08-quotation.md §19) — completion & review.
//
// Once a wedding is COMPLETED, the couple can review each vendor they actually booked (a CONFIRMED / COMPLETED vendor booking on that
// wedding), once per booking, from their proposal link. A review is PENDING until staff publish it; only PUBLISHED reviews ever reach a
// public page. Verified reviews are kept apart from Vendor.rating / reviewCount and never change them.

const PUBLIC_LIST_MAX = 20;
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export interface ReviewDeps {
  db: Pick<typeof prisma, '$transaction'> & {
    wedding: Pick<typeof prisma.wedding, 'findUnique'>;
    vendorBooking: Pick<typeof prisma.vendorBooking, 'findMany' | 'findUnique'>;
    review: Pick<typeof prisma.review, 'findMany' | 'findUnique' | 'update'>;
  };
  logActivity: typeof activityLogRepository.create;
  userNames: typeof resolveUserNames;
}

const defaultDeps = (): ReviewDeps => ({ db: prisma, logActivity: activityLogRepository.create, userNames: resolveUserNames });

export interface StaffReview {
  id: string;
  vendorName: string;
  category: string;
  functionLabel: string;
  authorName: string;
  rating: number;
  comment: string | null;
  status: 'PENDING' | 'PUBLISHED' | 'HIDDEN';
  submittedAt: string;
  moderatedAt: string | null;
  moderatedByName: string | null;
}

const bookingSelect = {
  id: true,
  status: true,
  vendor: { select: { id: true, name: true, category: { select: { name: true } } } },
  weddingEvent: { select: { type: true, label: true, wedding: { select: { id: true, status: true, sourceBookingId: true } } } },
  review: { select: { id: true, rating: true, comment: true, authorName: true, status: true } },
} as const;

export function createReviewService(deps: ReviewDeps = defaultDeps()) {
  return {
    // The Reviews section of the couple's link: null until the wedding made from this booking is COMPLETED, or when nothing was booked.
    async forProposal(bookingId: string | null | undefined, coupleName: string | null): Promise<ProposalReviews | null> {
      if (!bookingId) return null;
      const wedding = await deps.db.wedding.findUnique({ where: { sourceBookingId: bookingId }, select: { id: true, status: true } });
      if (!wedding || wedding.status !== 'COMPLETED') return null;
      const bookings = await deps.db.vendorBooking.findMany({
        where: { status: { in: [...REVIEWABLE_BOOKING] }, weddingEvent: { weddingId: wedding.id } },
        select: bookingSelect,
        orderBy: { createdAt: 'asc' },
      });
      if (bookings.length === 0) return null;
      return {
        defaultName: coupleName?.trim() || '',
        items: bookings.map((b) => ({
          bookingId: b.id,
          vendorName: b.vendor.name,
          category: b.vendor.category.name,
          functionLabel: b.weddingEvent.label?.trim() || titleCase(b.weddingEvent.type),
          review: b.review ? { rating: b.review.rating, comment: b.review.comment, authorName: b.review.authorName, status: b.review.status } : null,
        })),
      };
    },

    // The couple's review of one booking. `quotationBookingId` is the booking their link belongs to (resolved by proposal.service); the
    // vendor booking must be on the wedding made from it. A PENDING review may be changed; once staff have published or hidden it, it
    // is final.
    async submit(quotationBookingId: string | null | undefined, vendorBookingId: unknown, raw: { rating: unknown; comment?: unknown; authorName?: unknown }): Promise<{ submitted: true }> {
      if (!quotationBookingId) throw new ConflictError('Reviews open once your wedding is completed');
      if (typeof vendorBookingId !== 'string' || !vendorBookingId) throw new ValidationError('Choose the vendor you are reviewing');
      const input = validateReview(raw);

      const booking = await deps.db.vendorBooking.findUnique({ where: { id: vendorBookingId }, select: bookingSelect });
      // A booking from someone else's wedding answers exactly like a missing one.
      if (!booking || booking.weddingEvent.wedding.sourceBookingId !== quotationBookingId) throw new NotFoundError('Vendor booking', vendorBookingId);
      const wedding = booking.weddingEvent.wedding;
      if (wedding.status !== 'COMPLETED') throw new ConflictError('Reviews open once your wedding is completed');
      if (!(REVIEWABLE_BOOKING as readonly string[]).includes(booking.status)) throw new ConflictError('This vendor was not booked for your wedding');
      if (booking.review && booking.review.status !== 'PENDING') throw new ConflictError('You have already reviewed this vendor — thank you!');

      await deps.db.$transaction(async (tx) => {
        try {
          if (booking.review) {
            await tx.review.update({ where: { id: booking.review.id }, data: { rating: input.rating, comment: input.comment, authorName: input.authorName } });
          } else {
            await tx.review.create({ data: { vendorId: booking.vendor.id, weddingId: wedding.id, vendorBookingId: booking.id, rating: input.rating, comment: input.comment, authorName: input.authorName } });
          }
        } catch (err) {
          // Two tabs sending at once: the unique booking id lets only one in.
          if ((err as { code?: string }).code === 'P2002') throw new ConflictError('Your review was just sent — please reload the page');
          throw err;
        }
        await deps.logActivity(
          {
            type: ActivityType.REVIEW_SUBMITTED,
            summary: `The couple ${booking.review ? 'updated their review of' : 'reviewed'} ${booking.vendor.name}: ${input.rating}/5 — publish or hide it`,
            detail: input.comment ?? undefined,
            wedding: { connect: { id: wedding.id } },
          },
          tx
        );
      });
      return { submitted: true };
    },

    // Staff: every review on a wedding, newest first.
    async listForWedding(weddingId: string): Promise<StaffReview[]> {
      const rows = await deps.db.review.findMany({
        where: { weddingId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, authorName: true, rating: true, comment: true, status: true, createdAt: true, moderatedAt: true, moderatedById: true,
          vendor: { select: { name: true, category: { select: { name: true } } } },
          vendorBooking: { select: { weddingEvent: { select: { type: true, label: true } } } },
        },
      });
      const names = await deps.userNames(rows.map((r) => r.moderatedById));
      return rows.map((r) => ({
        id: r.id,
        vendorName: r.vendor.name,
        category: r.vendor.category.name,
        functionLabel: r.vendorBooking ? r.vendorBooking.weddingEvent.label?.trim() || titleCase(r.vendorBooking.weddingEvent.type) : '',
        authorName: r.authorName,
        rating: r.rating,
        comment: r.comment,
        status: r.status,
        submittedAt: r.createdAt.toISOString(),
        moderatedAt: r.moderatedAt?.toISOString() ?? null,
        moderatedByName: r.moderatedById ? (names.get(r.moderatedById) ?? null) : null,
      }));
    },

    // Staff: publish a review (it appears on the vendor's page) or hide it (kept, never deleted). Either can be changed later.
    async moderate(weddingId: string, reviewId: string, status: unknown, actorId: string | null): Promise<{ status: 'PUBLISHED' | 'HIDDEN' }> {
      if (status !== 'PUBLISHED' && status !== 'HIDDEN') throw new ValidationError('Choose Publish or Hide');
      const review = await deps.db.review.findUnique({ where: { id: reviewId }, select: { id: true, weddingId: true, status: true, rating: true, vendor: { select: { name: true } } } });
      if (!review || review.weddingId !== weddingId) throw new NotFoundError('Review', reviewId);
      if (review.status === status) return { status };
      await deps.db.$transaction(async (tx) => {
        await tx.review.update({ where: { id: reviewId }, data: { status, moderatedAt: new Date(), moderatedById: actorId } });
        await deps.logActivity(
          {
            type: ActivityType.STATUS_CHANGED,
            summary: `Review of ${review.vendor.name} (${review.rating}/5) ${status === 'PUBLISHED' ? 'published on the vendor page' : 'hidden'}`,
            performedBy: actorId ? { connect: { id: actorId } } : undefined,
            wedding: { connect: { id: weddingId } },
          },
          tx
        );
      });
      return { status };
    },

    // The vendor's public page: PUBLISHED reviews only, newest first, with their own average.
    async publicForVendor(vendorId: string): Promise<{ summary: { average: number; count: number } | null; reviews: PublicReview[] }> {
      const [rows, all] = await Promise.all([
        deps.db.review.findMany({ where: { vendorId, status: 'PUBLISHED' }, orderBy: { createdAt: 'desc' }, take: PUBLIC_LIST_MAX, select: { authorName: true, rating: true, comment: true, createdAt: true } }),
        deps.db.review.findMany({ where: { vendorId, status: 'PUBLISHED' }, select: { rating: true } }),
      ]);
      return { summary: reviewSummary(all.map((r) => r.rating)), reviews: rows.map(toPublicReview) };
    },
  };
}

export const reviewService = createReviewService();
