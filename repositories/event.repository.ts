import { prisma } from '@/lib/prisma';
import { Prisma, type Event } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.EventWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.EventOrderByWithRelationInput | Prisma.EventOrderByWithRelationInput[];
}

export const eventRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<Event | null> {
    return tx.event.findUnique({ where: { id } });
  },

  async findBySlug(slug: string, tx: Tx | typeof prisma = prisma): Promise<Event | null> {
    return tx.event.findUnique({ where: { slug } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: Event[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.event.findMany({ where, skip, take, orderBy }),
      tx.event.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.EventCreateInput, tx: Tx | typeof prisma = prisma): Promise<Event> {
    return withPrismaErrors('Event', () => tx.event.create({ data }));
  },

  async update(id: string, data: Prisma.EventUpdateInput, tx: Tx | typeof prisma = prisma): Promise<Event> {
    return withPrismaErrors('Event', () => tx.event.update({ where: { id }, data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<Event> {
    return withPrismaErrors('Event', () => tx.event.delete({ where: { id } }));
  },
};
