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

// Every caller this sprint (the Wedding Finance section) needs line items,
// payments, and payment links to render an invoice, so unlike the minimal
// vendorBooking.repository.ts template, they're always included rather than
// left to each caller to request.
const withInvoiceDetails = { items: true, payments: true, paymentLinks: true } satisfies Prisma.InvoiceInclude;
export type InvoiceWithDetails = Prisma.InvoiceGetPayload<{ include: typeof withInvoiceDetails }>;

export const invoiceRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<InvoiceWithDetails | null> {
    return tx.invoice.findUnique({ where: { id }, include: withInvoiceDetails });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: InvoiceWithDetails[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.invoice.findMany({ where, skip, take, orderBy, include: withInvoiceDetails }),
      tx.invoice.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.InvoiceCreateInput, tx: Tx | typeof prisma = prisma): Promise<InvoiceWithDetails> {
    return withPrismaErrors('Invoice', () => tx.invoice.create({ data, include: withInvoiceDetails }));
  },

  async update(
    id: string,
    data: Prisma.InvoiceUpdateInput,
    tx: Tx | typeof prisma = prisma
  ): Promise<InvoiceWithDetails> {
    return withPrismaErrors('Invoice', () => tx.invoice.update({ where: { id }, data, include: withInvoiceDetails }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<InvoiceWithDetails> {
    return withPrismaErrors('Invoice', () => tx.invoice.delete({ where: { id }, include: withInvoiceDetails }));
  },
};
