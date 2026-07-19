import { prisma } from '@/lib/prisma';
import { Prisma, type WeddingEvent } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.WeddingEventWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.WeddingEventOrderByWithRelationInput;
}

export const weddingEventRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<WeddingEvent | null> {
    return tx.weddingEvent.findUnique({ where: { id } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: WeddingEvent[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.weddingEvent.findMany({ where, skip, take, orderBy }),
      tx.weddingEvent.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.WeddingEventCreateInput, tx: Tx | typeof prisma = prisma): Promise<WeddingEvent> {
    return withPrismaErrors('WeddingEvent', () => tx.weddingEvent.create({ data }));
  },

  async update(
    id: string,
    data: Prisma.WeddingEventUpdateInput,
    tx: Tx | typeof prisma = prisma
  ): Promise<WeddingEvent> {
    return withPrismaErrors('WeddingEvent', () => tx.weddingEvent.update({ where: { id }, data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<WeddingEvent> {
    return withPrismaErrors('WeddingEvent', () => tx.weddingEvent.delete({ where: { id } }));
  },
};
