import { prisma } from '@/lib/prisma';
import { Prisma, type Consultation } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.ConsultationWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.ConsultationOrderByWithRelationInput | Prisma.ConsultationOrderByWithRelationInput[];
}

// Standard interface per docs/repository-contract.md.
export const consultationRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<Consultation | null> {
    return tx.consultation.findUnique({ where: { id } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: Consultation[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.consultation.findMany({ where, skip, take, orderBy }),
      tx.consultation.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.ConsultationCreateInput, tx: Tx | typeof prisma = prisma): Promise<Consultation> {
    return withPrismaErrors('Consultation', () => tx.consultation.create({ data }));
  },

  async update(id: string, data: Prisma.ConsultationUpdateInput, tx: Tx | typeof prisma = prisma): Promise<Consultation> {
    return withPrismaErrors('Consultation', () => tx.consultation.update({ where: { id }, data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<Consultation> {
    return withPrismaErrors('Consultation', () => tx.consultation.delete({ where: { id } }));
  },

  async count(where?: Prisma.ConsultationWhereInput, tx: Tx | typeof prisma = prisma): Promise<number> {
    return tx.consultation.count({ where });
  },
};
