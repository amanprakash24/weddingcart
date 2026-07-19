import { prisma } from '@/lib/prisma';
import { Prisma, type VendorBooking } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.VendorBookingWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.VendorBookingOrderByWithRelationInput;
}

export const vendorBookingRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<VendorBooking | null> {
    return tx.vendorBooking.findUnique({ where: { id } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: VendorBooking[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.vendorBooking.findMany({ where, skip, take, orderBy }),
      tx.vendorBooking.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.VendorBookingCreateInput, tx: Tx | typeof prisma = prisma): Promise<VendorBooking> {
    return withPrismaErrors('VendorBooking', () => tx.vendorBooking.create({ data }));
  },

  async update(
    id: string,
    data: Prisma.VendorBookingUpdateInput,
    tx: Tx | typeof prisma = prisma
  ): Promise<VendorBooking> {
    return withPrismaErrors('VendorBooking', () => tx.vendorBooking.update({ where: { id }, data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<VendorBooking> {
    return withPrismaErrors('VendorBooking', () => tx.vendorBooking.delete({ where: { id } }));
  },
};
