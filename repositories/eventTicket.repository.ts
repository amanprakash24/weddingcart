import { prisma } from '@/lib/prisma';
import { Prisma, type EventTicket } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.EventTicketWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.EventTicketOrderByWithRelationInput | Prisma.EventTicketOrderByWithRelationInput[];
}

export const eventTicketRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<EventTicket | null> {
    return tx.eventTicket.findUnique({ where: { id } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: EventTicket[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.eventTicket.findMany({ where, skip, take, orderBy }),
      tx.eventTicket.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.EventTicketCreateInput, tx: Tx | typeof prisma = prisma): Promise<EventTicket> {
    return withPrismaErrors('EventTicket', () => tx.eventTicket.create({ data }));
  },

  async update(id: string, data: Prisma.EventTicketUpdateInput, tx: Tx | typeof prisma = prisma): Promise<EventTicket> {
    return withPrismaErrors('EventTicket', () => tx.eventTicket.update({ where: { id }, data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<EventTicket> {
    return withPrismaErrors('EventTicket', () => tx.eventTicket.delete({ where: { id } }));
  },
};
