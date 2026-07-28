import { categoryRepository } from '@/repositories/category.repository';
import type { Prisma } from '@/generated/prisma/client';

// Thin for now — Category has no cross-repository business logic yet. Kept as
// a service (rather than calling the repository straight from a route
// handler) to establish the Route Handler -> Service -> Repository layering
// from day one, per docs/repository-contract.md.
export const categoryService = {
  getById: categoryRepository.findById,
  getBySlug: categoryRepository.findBySlug,

  async list(params: { isSpecial?: boolean; skip?: number; take?: number }) {
    const where: Prisma.CategoryWhereInput = {};
    if (params.isSpecial !== undefined) where.isSpecial = params.isSpecial;

    const { data, total } = await categoryRepository.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { name: 'asc' },
    });

    // Live vendor counts, matching current /api/categories behavior — not a
    // stored/denormalized field.
    const withCounts = await Promise.all(
      data.map(async (category) => ({
        ...category,
        vendorCount: await categoryRepository.countVendors(category.id),
      }))
    );

    return { data: withCounts, total };
  },

  create: categoryRepository.create,
  update: categoryRepository.update,
  delete: categoryRepository.delete,
};
