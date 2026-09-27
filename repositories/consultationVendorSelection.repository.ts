import { prisma } from '@/lib/prisma';
import { Prisma, type ConsultationVendorSelection } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

const selectionInclude = {
  vendor: {
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      status: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  },
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ConsultationVendorSelectionInclude;

export type ConsultationVendorSelectionWithRelations = Prisma.ConsultationVendorSelectionGetPayload<{
  include: typeof selectionInclude;
}>;

export const consultationVendorSelectionRepository = {
  async findMany(consultationId: string, tx: Tx | typeof prisma = prisma): Promise<ConsultationVendorSelectionWithRelations[]> {
    return tx.consultationVendorSelection.findMany({
      where: { consultationId },
      include: selectionInclude,
      orderBy: { serviceKey: 'asc' },
    });
  },

  async upsert(
    data: Prisma.ConsultationVendorSelectionCreateInput,
    where: Prisma.ConsultationVendorSelectionWhereUniqueInput,
    update: Prisma.ConsultationVendorSelectionUpdateInput,
    tx: Tx | typeof prisma = prisma
  ): Promise<ConsultationVendorSelectionWithRelations> {
    return withPrismaErrors('Consultation vendor selection', () =>
      tx.consultationVendorSelection.upsert({ where, create: data, update, include: selectionInclude })
    );
  },

  async delete(
    where: Prisma.ConsultationVendorSelectionWhereUniqueInput,
    tx: Tx | typeof prisma = prisma
  ): Promise<ConsultationVendorSelection> {
    return withPrismaErrors('Consultation vendor selection', () => tx.consultationVendorSelection.delete({ where }));
  },
};
