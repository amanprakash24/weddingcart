import { prisma } from '@/lib/prisma';
import { Prisma, type Enquiry } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.EnquiryWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.EnquiryOrderByWithRelationInput | Prisma.EnquiryOrderByWithRelationInput[];
}

// Standard interface per docs/repository-contract.md.
export const enquiryRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<Enquiry | null> {
    return tx.enquiry.findUnique({ where: { id } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: Enquiry[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.enquiry.findMany({ where, skip, take, orderBy }),
      tx.enquiry.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.EnquiryCreateInput, tx: Tx | typeof prisma = prisma): Promise<Enquiry> {
    return withPrismaErrors('Enquiry', () => tx.enquiry.create({ data }));
  },

  async update(id: string, data: Prisma.EnquiryUpdateInput, tx: Tx | typeof prisma = prisma): Promise<Enquiry> {
    return withPrismaErrors('Enquiry', () => tx.enquiry.update({ where: { id }, data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<Enquiry> {
    return withPrismaErrors('Enquiry', () => tx.enquiry.delete({ where: { id } }));
  },
};
