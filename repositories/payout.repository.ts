import { prisma } from '@/lib/prisma';
import { Prisma, type Payout } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.PayoutWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.PayoutOrderByWithRelationInput;
}

// No delete — payouts are financial records, never removed once created,
// same posture as Payment/PaymentLink.
export const payoutRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<Payout | null> {
    return tx.payout.findUnique({ where: { id } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: Payout[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.payout.findMany({ where, skip, take, orderBy }),
      tx.payout.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.PayoutCreateInput, tx: Tx | typeof prisma = prisma): Promise<Payout> {
    return withPrismaErrors('Payout', () => tx.payout.create({ data }));
  },

  async update(id: string, data: Prisma.PayoutUpdateInput, tx: Tx | typeof prisma = prisma): Promise<Payout> {
    return withPrismaErrors('Payout', () => tx.payout.update({ where: { id }, data }));
  },
};
