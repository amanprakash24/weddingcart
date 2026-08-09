import { blogRepository } from '@/repositories/blog.repository';
import { NotFoundError } from '@/lib/errors';
import type { Prisma } from '@/generated/prisma/client';

export const blogService = {
  getById: blogRepository.findById,
  getBySlug: blogRepository.findBySlug,
  getBySlugOrId: blogRepository.findBySlugOrId,

  // Mirrors current /api/blogs GET: published-only by default, category
  // filter, newest-first. `includeUnpublished` is a caller decision (route
  // handler decides whether the requester is allowed to see drafts) — this
  // service does not itself check admin status.
  async list(params: {
    category?: string;
    includeUnpublished?: boolean;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.BlogWhereInput = params.includeUnpublished ? {} : { status: 'PUBLISHED' };
    if (params.category && params.category !== 'all') where.category = params.category;

    return blogRepository.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
  },

  async create(data: Prisma.BlogCreateInput) {
    return blogRepository.create({
      ...data,
      publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
    });
  },

  // Takes slug-or-id (matches the [slug] route param, which the live Mongo
  // route also accepted as either) and resolves to the real row first, both
  // to find the real id for blogRepository.update and to decide publishedAt.
  //
  // publishedAt is set only on an actual DRAFT -> PUBLISHED transition with
  // no existing timestamp — improved over the old Mongo behavior, which
  // reset publishedAt to now() on every save of an already-published post
  // (since the client never sends publishedAt, `!body.publishedAt` was
  // always true). Editing an already-published post, or a draft that still
  // carries a timestamp from a previous publish cycle, no longer bumps it.
  async update(slugOrId: string, data: Prisma.BlogUpdateInput) {
    const existing = await blogRepository.findBySlugOrId(slugOrId);
    if (!existing) return null;

    if (data.status === 'PUBLISHED' && existing.status !== 'PUBLISHED' && !existing.publishedAt) {
      data.publishedAt = new Date();
    }

    return blogRepository.update(existing.id, data);
  },

  async delete(slugOrId: string) {
    const existing = await blogRepository.findBySlugOrId(slugOrId);
    if (!existing) throw new NotFoundError('Blog', slugOrId);
    return blogRepository.delete(existing.id);
  },
};
