import { prisma } from '@/lib/prisma';
import { Prisma, type Booking } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

// Originally minimal (findById/update only) — served only the not-yet-wired
// conversion pipeline (docs/wedding-os/track-b-conversion-pipeline.md), while
// the live /api/bookings route owned full CRUD via Mongoose. findMany/create
// added here to migrate that route onto Prisma; the conversion pipeline
// itself remains untouched.
const withItems = { items: true } satisfies Prisma.BookingInclude;
export type BookingWithItems = Prisma.BookingGetPayload<{ include: typeof withItems }>;

export interface FindManyParams {
  where?: Prisma.BookingWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.BookingOrderByWithRelationInput | Prisma.BookingOrderByWithRelationInput[];
}

export const bookingRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<BookingWithItems | null> {
    return tx.booking.findUnique({ where: { id }, include: withItems });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: BookingWithItems[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.booking.findMany({ where, skip, take, orderBy, include: withItems }),
      tx.booking.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.BookingCreateInput, tx: Tx | typeof prisma = prisma): Promise<BookingWithItems> {
    return withPrismaErrors('Booking', () => tx.booking.create({ data, include: withItems }));
  },

  async update(id: string, data: Prisma.BookingUpdateInput, tx: Tx | typeof prisma = prisma): Promise<Booking> {
    return withPrismaErrors('Booking', () => tx.booking.update({ where: { id }, data }));
  },
};
