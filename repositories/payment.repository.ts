import { prisma } from '@/lib/prisma';
import { Prisma, type Payment } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

// Built ahead of any route calling create/update — same "repository before
// its write path is wired" precedent as Milestone 2's CategoryRepository.
// Payment creation is genuinely blocked on Razorpay integration (Sprint
// 7.2/7.5), not deferred out of convenience, so this repo isn't called by
// weddingWorkspace.service.ts yet either.

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.PaymentWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.PaymentOrderByWithRelationInput;
}

export const paymentRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<Payment | null> {
    return tx.payment.findUnique({ where: { id } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: Payment[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.payment.findMany({ where, skip, take, orderBy }),
      tx.payment.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.PaymentCreateInput, tx: Tx | typeof prisma = prisma): Promise<Payment> {
    return withPrismaErrors('Payment', () => tx.payment.create({ data }));
  },

  async update(id: string, data: Prisma.PaymentUpdateInput, tx: Tx | typeof prisma = prisma): Promise<Payment> {
    return withPrismaErrors('Payment', () => tx.payment.update({ where: { id }, data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<Payment> {
    return withPrismaErrors('Payment', () => tx.payment.delete({ where: { id } }));
  },
};
