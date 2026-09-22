import { prisma } from '@/lib/prisma';
import { Prisma, type VendorProspect } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.VendorProspectWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.VendorProspectOrderByWithRelationInput;
}

export const vendorProspectRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<VendorProspect | null> {
    return tx.vendorProspect.findUnique({ where: { id } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: VendorProspect[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.vendorProspect.findMany({ where, skip, take, orderBy }),
      tx.vendorProspect.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.VendorProspectCreateInput, tx: Tx | typeof prisma = prisma): Promise<VendorProspect> {
    return withPrismaErrors('VendorProspect', () => tx.vendorProspect.create({ data }));
  },

  async createMany(data: Prisma.VendorProspectCreateManyInput[], tx: Tx | typeof prisma = prisma) {
    return tx.vendorProspect.createMany({ data });
  },

  async update(id: string, data: Prisma.VendorProspectUpdateInput, tx: Tx | typeof prisma = prisma): Promise<VendorProspect> {
    return withPrismaErrors('VendorProspect', () => tx.vendorProspect.update({ where: { id }, data }));
  },
};
