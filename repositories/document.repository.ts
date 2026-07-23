import { prisma } from '@/lib/prisma';
import { Prisma, type Document } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.DocumentWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.DocumentOrderByWithRelationInput;
}

export const documentRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<Document | null> {
    return tx.document.findUnique({ where: { id } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: Document[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.document.findMany({ where, skip, take, orderBy }),
      tx.document.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.DocumentCreateInput, tx: Tx | typeof prisma = prisma): Promise<Document> {
    return withPrismaErrors('Document', () => tx.document.create({ data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<Document> {
    return withPrismaErrors('Document', () => tx.document.delete({ where: { id } }));
  },
};
