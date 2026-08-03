import { prisma } from '@/lib/prisma';
import { Prisma, type CommissionRate } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.CommissionRateWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.CommissionRateOrderByWithRelationInput;
}

export const commissionRateRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<CommissionRate | null> {
    return tx.commissionRate.findUnique({ where: { id } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: CommissionRate[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.commissionRate.findMany({ where, skip, take, orderBy }),
      tx.commissionRate.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.CommissionRateCreateInput, tx: Tx | typeof prisma = prisma): Promise<CommissionRate> {
    return withPrismaErrors('CommissionRate', () => tx.commissionRate.create({ data }));
  },

  // Resolves the rate actually applicable right now: the most recent
  // category-specific row, falling back to the most recent global
  // (categoryId: null) row. Rate history is append-only via effectiveFrom —
  // no update/delete here, a rate change is a new row, not an edit.
  async findCurrentRate(categoryId: string, tx: Tx | typeof prisma = prisma): Promise<CommissionRate> {
    const categoryRate = await tx.commissionRate.findFirst({
      where: { categoryId, effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (categoryRate) return categoryRate;

    const globalRate = await tx.commissionRate.findFirst({
      where: { categoryId: null, effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!globalRate) {
      throw new Error('No CommissionRate configured — run scripts/seed-commission-rates.mjs');
    }
    return globalRate;
  },
};
