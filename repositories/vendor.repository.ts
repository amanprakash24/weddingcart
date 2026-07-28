import { prisma } from '@/lib/prisma';
import { Prisma, type Vendor } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

// Includes packages/faqs by default — every current Mongo vendor read
// (list + detail) embeds these subdocuments, so callers get the same shape
// without having to remember to ask for the relation.
const withRelations = { packages: true, faqs: true } satisfies Prisma.VendorInclude;

export type VendorWithRelations = Prisma.VendorGetPayload<{ include: typeof withRelations }>;

export interface FindManyParams {
  where?: Prisma.VendorWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.VendorOrderByWithRelationInput | Prisma.VendorOrderByWithRelationInput[];
}

export const vendorRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<VendorWithRelations | null> {
    return tx.vendor.findUnique({ where: { id }, include: withRelations });
  },

  async findBySlug(slug: string, tx: Tx | typeof prisma = prisma): Promise<VendorWithRelations | null> {
    return tx.vendor.findUnique({ where: { slug }, include: withRelations });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: VendorWithRelations[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.vendor.findMany({ where, skip, take, orderBy, include: withRelations }),
      tx.vendor.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.VendorCreateInput, tx: Tx | typeof prisma = prisma): Promise<Vendor> {
    return withPrismaErrors('Vendor', () => tx.vendor.create({ data }));
  },

  async update(id: string, data: Prisma.VendorUpdateInput, tx: Tx | typeof prisma = prisma): Promise<Vendor> {
    return withPrismaErrors('Vendor', () => tx.vendor.update({ where: { id }, data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<Vendor> {
    return withPrismaErrors('Vendor', () => tx.vendor.delete({ where: { id } }));
  },
};
