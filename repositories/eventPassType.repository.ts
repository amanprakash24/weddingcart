import { prisma } from '@/lib/prisma';
import { Prisma, type EventPassType } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.EventPassTypeWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.EventPassTypeOrderByWithRelationInput | Prisma.EventPassTypeOrderByWithRelationInput[];
}

export const eventPassTypeRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<EventPassType | null> {
    return tx.eventPassType.findUnique({ where: { id } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: EventPassType[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.eventPassType.findMany({ where, skip, take, orderBy }),
      tx.eventPassType.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.EventPassTypeCreateInput, tx: Tx | typeof prisma = prisma): Promise<EventPassType> {
    return withPrismaErrors('EventPassType', () => tx.eventPassType.create({ data }));
  },

  async update(id: string, data: Prisma.EventPassTypeUpdateInput, tx: Tx | typeof prisma = prisma): Promise<EventPassType> {
    return withPrismaErrors('EventPassType', () => tx.eventPassType.update({ where: { id }, data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<EventPassType> {
    return withPrismaErrors('EventPassType', () => tx.eventPassType.delete({ where: { id } }));
  },
};
