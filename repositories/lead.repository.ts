import { prisma } from '@/lib/prisma';
import { Prisma, type Lead } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.LeadWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.LeadOrderByWithRelationInput | Prisma.LeadOrderByWithRelationInput[];
}

// Standard interface per docs/repository-contract.md. Lead is the lowest-detail
// capture entity (phone-only popup, docs/wedding-os/02-crm.md §2) — no
// name/city/budget fields, unlike Enquiry/Consultation.
export const leadRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<Lead | null> {
    return tx.lead.findUnique({ where: { id } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: Lead[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.lead.findMany({ where, skip, take, orderBy }),
      tx.lead.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.LeadCreateInput, tx: Tx | typeof prisma = prisma): Promise<Lead> {
    return withPrismaErrors('Lead', () => tx.lead.create({ data }));
  },

  async update(id: string, data: Prisma.LeadUpdateInput, tx: Tx | typeof prisma = prisma): Promise<Lead> {
    return withPrismaErrors('Lead', () => tx.lead.update({ where: { id }, data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<Lead> {
    return withPrismaErrors('Lead', () => tx.lead.delete({ where: { id } }));
  },
};
