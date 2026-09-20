import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

// Every read includes the line items in their saved order — a quotation is never
// meaningful without them.
const withItems = {
  items: { orderBy: { sortOrder: 'asc' } },
  // The Booking created from this quotation, if any (Booking.quotationId is unique).
  booking: { select: { id: true, status: true } },
} satisfies Prisma.QuotationInclude;
export type QuotationWithItems = Prisma.QuotationGetPayload<{ include: typeof withItems }>;

export const quotationRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<QuotationWithItems | null> {
    return tx.quotation.findUnique({ where: { id }, include: withItems });
  },

  async findMany(
    where: Prisma.QuotationWhereInput,
    tx: Tx | typeof prisma = prisma
  ): Promise<QuotationWithItems[]> {
    return tx.quotation.findMany({ where, include: withItems, orderBy: [{ createdAt: 'desc' }] });
  },

  async findFirst(
    where: Prisma.QuotationWhereInput,
    tx: Tx | typeof prisma = prisma
  ): Promise<QuotationWithItems | null> {
    return tx.quotation.findFirst({ where, include: withItems, orderBy: [{ createdAt: 'desc' }] });
  },

  async count(where: Prisma.QuotationWhereInput, tx: Tx | typeof prisma = prisma): Promise<number> {
    return tx.quotation.count({ where });
  },

  // Highest number in a QTN-YYYYMM- bucket — the input to lib/numbering.ts.
  async findLastNumber(bucket: string, tx: Tx | typeof prisma = prisma): Promise<string | null> {
    const last = await tx.quotation.findFirst({
      where: { quotationNumber: { startsWith: bucket } },
      orderBy: { quotationNumber: 'desc' },
      select: { quotationNumber: true },
    });
    return last?.quotationNumber ?? null;
  },

  async create(data: Prisma.QuotationCreateInput, tx: Tx | typeof prisma = prisma): Promise<QuotationWithItems> {
    return withPrismaErrors('Quotation', () => tx.quotation.create({ data, include: withItems }));
  },

  async update(
    id: string,
    data: Prisma.QuotationUpdateInput,
    tx: Tx | typeof prisma = prisma
  ): Promise<QuotationWithItems> {
    return withPrismaErrors('Quotation', () => tx.quotation.update({ where: { id }, data, include: withItems }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma) {
    return withPrismaErrors('Quotation', () => tx.quotation.delete({ where: { id } }));
  },
};
