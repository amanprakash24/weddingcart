import { blogRepository } from '@/repositories/blog.repository';
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

  update: blogRepository.update,
  delete: blogRepository.delete,
};
