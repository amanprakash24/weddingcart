import { prisma } from '@/lib/prisma';
import { Prisma, type EventOrder } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.EventOrderWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.EventOrderOrderByWithRelationInput | Prisma.EventOrderOrderByWithRelationInput[];
}

export const eventOrderRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<EventOrder | null> {
    return tx.eventOrder.findUnique({ where: { id } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: EventOrder[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.eventOrder.findMany({ where, skip, take, orderBy }),
      tx.eventOrder.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.EventOrderCreateInput, tx: Tx | typeof prisma = prisma): Promise<EventOrder> {
    return withPrismaErrors('EventOrder', () => tx.eventOrder.create({ data }));
  },

  async update(id: string, data: Prisma.EventOrderUpdateInput, tx: Tx | typeof prisma = prisma): Promise<EventOrder> {
    return withPrismaErrors('EventOrder', () => tx.eventOrder.update({ where: { id }, data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<EventOrder> {
    return withPrismaErrors('EventOrder', () => tx.eventOrder.delete({ where: { id } }));
  },
};
