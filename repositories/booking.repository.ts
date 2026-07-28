import { prisma } from '@/lib/prisma';
import { Prisma, type Booking } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

// Only what Track B's Wedding-conversion pipeline needs — the existing
// Mongo-backed /api/bookings route is untouched by this. `items` is always
// included since the conversion pipeline needs every line to build
// VendorBooking records from.
const withItems = { items: true } satisfies Prisma.BookingInclude;
export type BookingWithItems = Prisma.BookingGetPayload<{ include: typeof withItems }>;

export const bookingRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<BookingWithItems | null> {
    return tx.booking.findUnique({ where: { id }, include: withItems });
  },

  async update(id: string, data: Prisma.BookingUpdateInput, tx: Tx | typeof prisma = prisma): Promise<Booking> {
    return withPrismaErrors('Booking', () => tx.booking.update({ where: { id }, data }));
  },
};
