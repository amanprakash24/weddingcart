import { prisma } from '@/lib/prisma';
import { Prisma, type TimelineMilestone } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.TimelineMilestoneWhereInput;
  orderBy?: Prisma.TimelineMilestoneOrderByWithRelationInput;
}

export const timelineMilestoneRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<TimelineMilestone | null> {
    return tx.timelineMilestone.findUnique({ where: { id } });
  },

  async findMany(
    { where, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<TimelineMilestone[]> {
    return tx.timelineMilestone.findMany({ where, orderBy });
  },

  async create(data: Prisma.TimelineMilestoneCreateInput, tx: Tx | typeof prisma = prisma): Promise<TimelineMilestone> {
    return withPrismaErrors('TimelineMilestone', () => tx.timelineMilestone.create({ data }));
  },

  async createMany(data: Prisma.TimelineMilestoneCreateManyInput[], tx: Tx | typeof prisma = prisma): Promise<void> {
    await tx.timelineMilestone.createMany({ data });
  },

  async update(
    id: string,
    data: Prisma.TimelineMilestoneUpdateInput,
    tx: Tx | typeof prisma = prisma
  ): Promise<TimelineMilestone> {
    return withPrismaErrors('TimelineMilestone', () => tx.timelineMilestone.update({ where: { id }, data }));
  },
};
