import { prisma } from '@/lib/prisma';
import { Prisma, type Category } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.CategoryWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.CategoryOrderByWithRelationInput;
}

// Standard interface per docs/repository-contract.md. No business logic here —
// callers (services) own validation and cross-repository composition.
export const categoryRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<Category | null> {
    return tx.category.findUnique({ where: { id } });
  },

  async findBySlug(slug: string, tx: Tx | typeof prisma = prisma): Promise<Category | null> {
    return tx.category.findUnique({ where: { slug } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: Category[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.category.findMany({ where, skip, take, orderBy }),
      tx.category.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.CategoryCreateInput, tx: Tx | typeof prisma = prisma): Promise<Category> {
    return withPrismaErrors('Category', () => tx.category.create({ data }));
  },

  async update(
    id: string,
    data: Prisma.CategoryUpdateInput,
    tx: Tx | typeof prisma = prisma
  ): Promise<Category> {
    return withPrismaErrors('Category', () => tx.category.update({ where: { id }, data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<Category> {
    return withPrismaErrors('Category', () => tx.category.delete({ where: { id } }));
  },

  // Mirrors the live `/api/categories` behavior: vendorCount is computed from
  // real Vendor rows, not trusted as a stored/denormalized field.
  async countVendors(categoryId: string, tx: Tx | typeof prisma = prisma): Promise<number> {
    return tx.vendor.count({ where: { categoryId } });
  },
};
