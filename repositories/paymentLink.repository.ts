import { prisma } from '@/lib/prisma';
import { Prisma, type PaymentLink } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.PaymentLinkWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.PaymentLinkOrderByWithRelationInput;
}

export const paymentLinkRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<PaymentLink | null> {
    return tx.paymentLink.findUnique({ where: { id } });
  },

  async findByRazorpayId(razorpayPaymentLinkId: string, tx: Tx | typeof prisma = prisma): Promise<PaymentLink | null> {
    return tx.paymentLink.findUnique({ where: { razorpayPaymentLinkId } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: PaymentLink[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.paymentLink.findMany({ where, skip, take, orderBy }),
      tx.paymentLink.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.PaymentLinkCreateInput, tx: Tx | typeof prisma = prisma): Promise<PaymentLink> {
    return withPrismaErrors('PaymentLink', () => tx.paymentLink.create({ data }));
  },

  async update(id: string, data: Prisma.PaymentLinkUpdateInput, tx: Tx | typeof prisma = prisma): Promise<PaymentLink> {
    return withPrismaErrors('PaymentLink', () => tx.paymentLink.update({ where: { id }, data }));
  },
};
