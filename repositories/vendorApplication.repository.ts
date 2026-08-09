import { prisma } from '@/lib/prisma';
import { Prisma, type VendorApplication } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

// category is a required relation and every current caller needs it (the
// admin display flattens it to a name, and approval needs category.slug) —
// included by default rather than composed separately in the service.
const withCategory = { category: true } satisfies Prisma.VendorApplicationInclude;
export type VendorApplicationWithCategory = Prisma.VendorApplicationGetPayload<{ include: typeof withCategory }>;

export interface FindManyParams {
  where?: Prisma.VendorApplicationWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.VendorApplicationOrderByWithRelationInput | Prisma.VendorApplicationOrderByWithRelationInput[];
}

export const vendorApplicationRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<VendorApplicationWithCategory | null> {
    return tx.vendorApplication.findUnique({ where: { id }, include: withCategory });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: VendorApplicationWithCategory[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.vendorApplication.findMany({ where, skip, take, orderBy, include: withCategory }),
      tx.vendorApplication.count({ where }),
    ]);
    return { data, total };
  },

  async create(
    data: Prisma.VendorApplicationCreateInput,
    tx: Tx | typeof prisma = prisma
  ): Promise<VendorApplicationWithCategory> {
    return withPrismaErrors('VendorApplication', () => tx.vendorApplication.create({ data, include: withCategory }));
  },

  async update(
    id: string,
    data: Prisma.VendorApplicationUpdateInput,
    tx: Tx | typeof prisma = prisma
  ): Promise<VendorApplicationWithCategory> {
    return withPrismaErrors('VendorApplication', () =>
      tx.vendorApplication.update({ where: { id }, data, include: withCategory })
    );
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<VendorApplication> {
    return withPrismaErrors('VendorApplication', () => tx.vendorApplication.delete({ where: { id } }));
  },
};
