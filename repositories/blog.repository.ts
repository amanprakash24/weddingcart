import { prisma } from '@/lib/prisma';
import { Prisma, type Blog } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.BlogWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.BlogOrderByWithRelationInput | Prisma.BlogOrderByWithRelationInput[];
}

export const blogRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<Blog | null> {
    return tx.blog.findUnique({ where: { id } });
  },

  async findBySlug(slug: string, tx: Tx | typeof prisma = prisma): Promise<Blog | null> {
    return tx.blog.findUnique({ where: { slug } });
  },

  // The live Mongo route looks a blog up by slug OR _id in one query
  // ($or). Kept as a named method rather than folding into findById/
  // findBySlug, since it's a real behavioral quirk worth being explicit about.
  async findBySlugOrId(slugOrId: string, tx: Tx | typeof prisma = prisma): Promise<Blog | null> {
    return tx.blog.findFirst({ where: { OR: [{ slug: slugOrId }, { id: slugOrId }] } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: Blog[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.blog.findMany({ where, skip, take, orderBy }),
      tx.blog.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.BlogCreateInput, tx: Tx | typeof prisma = prisma): Promise<Blog> {
    return withPrismaErrors('Blog', () => tx.blog.create({ data }));
  },

  async update(id: string, data: Prisma.BlogUpdateInput, tx: Tx | typeof prisma = prisma): Promise<Blog> {
    return withPrismaErrors('Blog', () => tx.blog.update({ where: { id }, data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<Blog> {
    return withPrismaErrors('Blog', () => tx.blog.delete({ where: { id } }));
  },
};
