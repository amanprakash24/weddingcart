import { prisma } from '@/lib/prisma';
import { Prisma, type LeadInsight } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.LeadInsightWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.LeadInsightOrderByWithRelationInput;
}

// Standard interface per docs/repository-contract.md. Sprint 5.2 only calls
// findMany (read-only, empty-safe — no live AI generation or manual-add UI
// yet); create/update/delete exist for contract consistency, same as
// leadRepository's unused `delete` today.
export const leadInsightRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<LeadInsight | null> {
    return tx.leadInsight.findUnique({ where: { id } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: LeadInsight[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.leadInsight.findMany({ where, skip, take, orderBy: orderBy ?? { createdAt: 'desc' } }),
      tx.leadInsight.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.LeadInsightCreateInput, tx: Tx | typeof prisma = prisma): Promise<LeadInsight> {
    return withPrismaErrors('LeadInsight', () => tx.leadInsight.create({ data }));
  },

  async update(id: string, data: Prisma.LeadInsightUpdateInput, tx: Tx | typeof prisma = prisma): Promise<LeadInsight> {
    return withPrismaErrors('LeadInsight', () => tx.leadInsight.update({ where: { id }, data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<LeadInsight> {
    return withPrismaErrors('LeadInsight', () => tx.leadInsight.delete({ where: { id } }));
  },
};
