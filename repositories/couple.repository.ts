import { prisma } from '@/lib/prisma';
import { Prisma, type Couple } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export const coupleRepository = {
  async findByWeddingId(weddingId: string, tx: Tx | typeof prisma = prisma): Promise<Couple | null> {
    return tx.couple.findUnique({ where: { weddingId } });
  },

  async create(data: Prisma.CoupleCreateInput, tx: Tx | typeof prisma = prisma): Promise<Couple> {
    return withPrismaErrors('Couple', () => tx.couple.create({ data }));
  },

  async update(weddingId: string, data: Prisma.CoupleUpdateInput, tx: Tx | typeof prisma = prisma): Promise<Couple> {
    return withPrismaErrors('Couple', () => tx.couple.update({ where: { weddingId }, data }));
  },
};
