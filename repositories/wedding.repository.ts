import { prisma } from '@/lib/prisma';
import { Prisma, type Wedding } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.WeddingWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.WeddingOrderByWithRelationInput;
}

export const weddingRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<Wedding | null> {
    return tx.wedding.findUnique({ where: { id } });
  },

  // Idempotency check for the conversion pipeline (docs/wedding-os/domain-model.md
  // §5) — a Booking should never spawn two Weddings. Mirrors the same
  // idempotent-upsert discipline used throughout scripts/migrate-to-postgres.mjs.
  async findBySourceBookingId(bookingId: string, tx: Tx | typeof prisma = prisma): Promise<Wedding | null> {
    return tx.wedding.findUnique({ where: { sourceBookingId: bookingId } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: Wedding[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.wedding.findMany({ where, skip, take, orderBy }),
      tx.wedding.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.WeddingCreateInput, tx: Tx | typeof prisma = prisma): Promise<Wedding> {
    return withPrismaErrors('Wedding', () => tx.wedding.create({ data }));
  },

  async update(id: string, data: Prisma.WeddingUpdateInput, tx: Tx | typeof prisma = prisma): Promise<Wedding> {
    return withPrismaErrors('Wedding', () => tx.wedding.update({ where: { id }, data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<Wedding> {
    return withPrismaErrors('Wedding', () => tx.wedding.delete({ where: { id } }));
  },
};
