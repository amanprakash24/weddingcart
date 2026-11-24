import { prisma } from '@/lib/prisma';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { averageRating, checkPlatformReview, publicName, type PlatformReviewInput } from '@/lib/reviews/platformReview';
import { checkNextEvent, consultationFromNextEvent, type NextEventInput } from '@/lib/reviews/nextEvent';

// Reviews of Shaadi Shopping itself (24 Nov 2026). Sent from the public /review page; PENDING until staff publish them. Only a
// published review's first name + initial, stars, words and month are ever shown publicly — never the mobile or wedding ID.

export type PublicPlatformReview = { id: string; name: string; rating: number; comment: string | null; month: string };
type Status = 'PENDING' | 'PUBLISHED' | 'HIDDEN';

const monthWords = (d: Date) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(d);

export const platformReviewService = {
  async submit(input: PlatformReviewInput): Promise<{ id: string }> {
    const checked = checkPlatformReview(input);
    if (!checked.ok) throw new ValidationError(checked.error);
    const row = await prisma.platformReview.create({ data: checked.value, select: { id: true } });
    return { id: row.id };
  },

  // The public page: published reviews, newest first, and their average.
  async published(limit = 30): Promise<{ summary: { average: number; count: number } | null; reviews: PublicPlatformReview[] }> {
    const [rows, ratings] = await Promise.all([
      prisma.platformReview.findMany({ where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, authorName: true, rating: true, comment: true, createdAt: true } }),
      prisma.platformReview.findMany({ where: { status: 'PUBLISHED' }, select: { rating: true } }),
    ]);
    return {
      summary: averageRating(ratings.map((r) => r.rating)),
      reviews: rows.map((r) => ({ id: r.id, name: publicName(r.authorName), rating: r.rating, comment: r.comment, month: monthWords(r.createdAt) })),
    };
  },

  // Staff: everything, with the details they use to check a review is genuine.
  async forAdmin(status?: Status) {
    const [rows, counts] = await Promise.all([
      prisma.platformReview.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 200, include: { moderatedBy: { select: { name: true } } } }),
      prisma.platformReview.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return { reviews: rows, counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<Status, number>> };
  },

  // Publish (shown on /review) or hide (kept, never deleted). Either can be changed later.
  async moderate(id: string, status: Status, actorId: string | null) {
    if (status !== 'PUBLISHED' && status !== 'HIDDEN' && status !== 'PENDING') throw new ValidationError('Choose publish or hide');
    const found = await prisma.platformReview.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundError('PlatformReview', id);
    return prisma.platformReview.update({ where: { id }, data: { status, moderatedAt: new Date(), moderatedById: actorId } });
  },
};

// "This is not goodbye" (24 Nov 2026): a family's next celebration, or a relative/friend they refer, becomes a Shaadi Shopping
// consultation in the CRM for the team to call — the same place as the "Begin your journey" form. Run in Shaadi Shopping's scope.
export const reviewFollowUpService = {
  async submit(input: NextEventInput): Promise<{ id: string }> {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const checked = checkNextEvent(input, today);
    if (!checked.ok) throw new ValidationError(checked.error);
    const row = await prisma.consultation.create({ data: consultationFromNextEvent(checked.value), select: { id: true } });
    return { id: row.id };
  },
};
