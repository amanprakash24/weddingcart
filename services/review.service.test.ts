/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { reviewSummary, toPublicReview } from '@/lib/reviews/reviewView';
import { validateReview } from '@/lib/reviews/rules';

// All dependencies are fakes passed to createReviewService — nothing touches a database.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createReviewService } = await import('./review.service');

type Rev = { id: string; vendorId: string; weddingId: string; vendorBookingId: string; authorName: string; rating: number; comment: string | null; status: 'PENDING' | 'PUBLISHED' | 'HIDDEN'; createdAt: Date; moderatedAt: Date | null; moderatedById: string | null };
let weddingStatus: string;
let bookingStatus: string;
let reviews: Rev[];

const booking = (id: string, vendor: string) => ({
  id,
  status: bookingStatus,
  vendor: { id: `v-${id}`, name: vendor, category: { name: 'Venues' } },
  weddingEvent: { type: 'WEDDING', label: null, wedding: { id: 'w1', status: weddingStatus, sourceBookingId: 'b1' } },
  get review() {
    const r = reviews.find((x) => x.vendorBookingId === id);
    return r ? { id: r.id, rating: r.rating, comment: r.comment, authorName: r.authorName, status: r.status } : null;
  },
});

const create = mock(async ({ data }: { data: Partial<Rev> }) => {
  const r = { id: `r${reviews.length + 1}`, status: 'PENDING', createdAt: new Date('2026-12-20T06:00:00Z'), moderatedAt: null, moderatedById: null, comment: null, ...data } as Rev;
  reviews.push(r);
  return r;
});
const update = mock(async ({ where, data }: { where: { id: string }; data: Partial<Rev> }) => Object.assign(reviews.find((r) => r.id === where.id)!, data));
const logActivity = mock(async () => ({}));
const tx = { review: { create, update } };
const db = {
  wedding: { findUnique: mock(async ({ where }: { where: { sourceBookingId: string } }) => (where.sourceBookingId === 'b1' ? { id: 'w1', status: weddingStatus } : null)) },
  vendorBooking: {
    findMany: mock(async () => [booking('vb1', 'Royal Palace'), booking('vb2', 'Annapurna Caterers')]),
    findUnique: mock(async ({ where }: { where: { id: string } }) => (['vb1', 'vb2'].includes(where.id) ? booking(where.id, where.id === 'vb1' ? 'Royal Palace' : 'Annapurna Caterers') : null)),
  },
  review: {
    findMany: mock(async ({ where }: { where: { vendorId?: string; weddingId?: string; status?: string } }) =>
      reviews
        .filter((r) => (!where.vendorId || r.vendorId === where.vendorId) && (!where.weddingId || r.weddingId === where.weddingId) && (!where.status || r.status === where.status))
        .map((r) => ({ ...r, vendor: { name: 'Royal Palace', category: { name: 'Venues' } }, vendorBooking: { weddingEvent: { type: 'WEDDING', label: null } } }))),
    findUnique: mock(async ({ where }: { where: { id: string } }) => {
      const r = reviews.find((x) => x.id === where.id);
      return r ? { ...r, vendor: { name: 'Royal Palace' } } : null;
    }),
    update,
  },
  $transaction: mock(async (fn: (t: typeof tx) => unknown) => fn(tx)),
};
const service = createReviewService({ db: db as never, logActivity: logActivity as never, userNames: async () => new Map([['u1', 'Gaurav']]) });

beforeEach(() => {
  weddingStatus = 'COMPLETED';
  bookingStatus = 'CONFIRMED';
  reviews = [];
  for (const m of [create, update, logActivity]) m.mockClear();
});

describe('rules', () => {
  test('a review needs 1–5 stars and a name; the comment is optional', () => {
    expect(validateReview({ rating: 5, comment: '  Lovely hall  ', authorName: ' Riya   & Arjun ' })).toEqual({ rating: 5, comment: 'Lovely hall', authorName: 'Riya & Arjun' });
    expect(validateReview({ rating: '4', authorName: 'Riya' })).toEqual({ rating: 4, comment: null, authorName: 'Riya' });
    for (const rating of [0, 6, 4.5, 'x', undefined]) expect(() => validateReview({ rating, authorName: 'Riya' })).toThrow(ValidationError);
    expect(() => validateReview({ rating: 5, authorName: ' ' })).toThrow('name');
    expect(() => validateReview({ rating: 5, authorName: 'Riya', comment: 'x'.repeat(1001) })).toThrow('1000');
  });

  test('no links or phone numbers on a public page', () => {
    expect(() => validateReview({ rating: 5, authorName: 'Riya', comment: 'see https://spam.example' })).toThrow('links');
    expect(() => validateReview({ rating: 5, authorName: 'Riya', comment: 'call 9876543210' })).toThrow('phone');
  });

  test('the summary averages only valid ratings, to one decimal', () => {
    expect(reviewSummary([])).toBeNull();
    expect(reviewSummary([5, 4, 4])).toEqual({ average: 4.3, count: 3 });
    expect(reviewSummary([5, 9])).toEqual({ average: 5, count: 1 });
  });

  test('the public shape is an allow-list', () => {
    expect(Object.keys(toPublicReview({ authorName: 'Riya', rating: 5, comment: null, createdAt: new Date() })).sort()).toEqual(['authorName', 'comment', 'date', 'rating']);
  });
});

describe('forProposal', () => {
  test('nothing until the wedding is completed', async () => {
    weddingStatus = 'ACTIVE';
    expect(await service.forProposal('b1', 'Riya & Arjun')).toBeNull();
    expect(await service.forProposal(null, 'Riya & Arjun')).toBeNull();
    expect(await service.forProposal('other', 'Riya & Arjun')).toBeNull();
  });

  test('the booked vendors, with the couple’s own review state', async () => {
    reviews.push({ id: 'r0', vendorId: 'v-vb1', weddingId: 'w1', vendorBookingId: 'vb1', authorName: 'Riya', rating: 5, comment: null, status: 'PUBLISHED', createdAt: new Date(), moderatedAt: null, moderatedById: null });
    const view = await service.forProposal('b1', 'Riya & Arjun');
    expect(view).toEqual({
      defaultName: 'Riya & Arjun',
      items: [
        { bookingId: 'vb1', vendorName: 'Royal Palace', category: 'Venues', functionLabel: 'Wedding', review: { rating: 5, comment: null, authorName: 'Riya', status: 'PUBLISHED' } },
        { bookingId: 'vb2', vendorName: 'Annapurna Caterers', category: 'Venues', functionLabel: 'Wedding', review: null },
      ],
    });
  });
});

describe('submit', () => {
  const good = { rating: 5, comment: 'Wonderful', authorName: 'Riya & Arjun' };

  test('creates a PENDING review tied to the booking and tells staff', async () => {
    await expect(service.submit('b1', 'vb1', good)).resolves.toEqual({ submitted: true });
    expect(reviews[0]).toMatchObject({ vendorId: 'v-vb1', weddingId: 'w1', vendorBookingId: 'vb1', rating: 5, status: 'PENDING' });
    expect((logActivity.mock.calls.at(-1) as unknown as [Record<string, unknown>])[0]).toMatchObject({ type: 'REVIEW_SUBMITTED', wedding: { connect: { id: 'w1' } } });
  });

  test('a PENDING review may be changed; a published one is final', async () => {
    await service.submit('b1', 'vb1', good);
    await service.submit('b1', 'vb1', { ...good, rating: 4 });
    expect(reviews).toHaveLength(1);
    expect(reviews[0].rating).toBe(4);
    reviews[0].status = 'PUBLISHED';
    await expect(service.submit('b1', 'vb1', good)).rejects.toBeInstanceOf(ConflictError);
  });

  test('only on a completed wedding, for a booking that really happened, on THIS couple’s wedding', async () => {
    weddingStatus = 'ACTIVE';
    await expect(service.submit('b1', 'vb1', good)).rejects.toBeInstanceOf(ConflictError);
    weddingStatus = 'COMPLETED';
    bookingStatus = 'DECLINED';
    await expect(service.submit('b1', 'vb1', good)).rejects.toBeInstanceOf(ConflictError);
    bookingStatus = 'CONFIRMED';
    await expect(service.submit('another-couple', 'vb1', good)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.submit('b1', 'nope', good)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.submit(null, 'vb1', good)).rejects.toBeInstanceOf(ConflictError);
    expect(create).not.toHaveBeenCalled();
  });

  test('two tabs at once: the unique booking lets one in, the other is told to reload', async () => {
    create.mockImplementationOnce(async () => { throw Object.assign(new Error('unique'), { code: 'P2002' }); });
    await expect(service.submit('b1', 'vb1', good)).rejects.toThrow('just sent');
  });
});

describe('moderation and the public page', () => {
  beforeEach(async () => {
    await service.submit('b1', 'vb1', { rating: 5, comment: 'Wonderful', authorName: 'Riya & Arjun' });
  });

  test('nothing is public until staff publish it', async () => {
    expect(await service.publicForVendor('v-vb1')).toEqual({ summary: null, reviews: [] });
    await service.moderate('w1', 'r1', 'PUBLISHED', 'u1');
    const pub = await service.publicForVendor('v-vb1');
    expect(pub.summary).toEqual({ average: 5, count: 1 });
    expect(pub.reviews[0]).toMatchObject({ authorName: 'Riya & Arjun', rating: 5, comment: 'Wonderful' });
    expect(reviews[0]).toMatchObject({ status: 'PUBLISHED', moderatedById: 'u1' });
  });

  test('hide takes it off the page; only Publish / Hide; only this wedding’s reviews', async () => {
    await service.moderate('w1', 'r1', 'PUBLISHED', 'u1');
    await service.moderate('w1', 'r1', 'HIDDEN', 'u1');
    expect((await service.publicForVendor('v-vb1')).reviews).toHaveLength(0);
    await expect(service.moderate('w1', 'r1', 'DELETED', 'u1')).rejects.toBeInstanceOf(ValidationError);
    await expect(service.moderate('w2', 'r1', 'PUBLISHED', 'u1')).rejects.toBeInstanceOf(NotFoundError);
  });

  test('staff list carries who moderated it', async () => {
    await service.moderate('w1', 'r1', 'PUBLISHED', 'u1');
    const [r] = await service.listForWedding('w1');
    expect(r).toMatchObject({ vendorName: 'Royal Palace', functionLabel: 'Wedding', status: 'PUBLISHED', moderatedByName: 'Gaurav' });
  });
});
