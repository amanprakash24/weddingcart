import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.InvoiceWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.InvoiceOrderByWithRelationInput;
}

// Every caller this sprint (the Wedding Finance section) needs both line
// items and payments to render an invoice, so unlike the minimal
// vendorBooking.repository.ts template, `items`/`payments` are always
// included rather than left to each caller to request.
const withItemsAndPayments = { items: true, payments: true } satisfies Prisma.InvoiceInclude;
export type InvoiceWithDetails = Prisma.InvoiceGetPayload<{ include: typeof withItemsAndPayments }>;

export const invoiceRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<InvoiceWithDetails | null> {
    return tx.invoice.findUnique({ where: { id }, include: withItemsAndPayments });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: InvoiceWithDetails[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.invoice.findMany({ where, skip, take, orderBy, include: withItemsAndPayments }),
      tx.invoice.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.InvoiceCreateInput, tx: Tx | typeof prisma = prisma): Promise<InvoiceWithDetails> {
    return withPrismaErrors('Invoice', () => tx.invoice.create({ data, include: withItemsAndPayments }));
  },

  async update(
    id: string,
    data: Prisma.InvoiceUpdateInput,
    tx: Tx | typeof prisma = prisma
  ): Promise<InvoiceWithDetails> {
    return withPrismaErrors('Invoice', () => tx.invoice.update({ where: { id }, data, include: withItemsAndPayments }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<InvoiceWithDetails> {
    return withPrismaErrors('Invoice', () => tx.invoice.delete({ where: { id }, include: withItemsAndPayments }));
  },
};
