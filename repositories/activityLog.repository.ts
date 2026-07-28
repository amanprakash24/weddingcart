import { prisma } from '@/lib/prisma';
import { Prisma, type ActivityLog } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.ActivityLogWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.ActivityLogOrderByWithRelationInput;
}

// Deliberately no `update`/`delete` — ActivityLog is append-only by design
// (prisma/schema.prisma has no `updatedAt` on this model for the same reason;
// see the "store events, not state" principle in the schema's header comment).
// Omitting these methods here, not just trusting callers not to use them.
export const activityLogRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<ActivityLog | null> {
    return tx.activityLog.findUnique({ where: { id } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: ActivityLog[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.activityLog.findMany({ where, skip, take, orderBy: orderBy ?? { createdAt: 'desc' } }),
      tx.activityLog.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.ActivityLogCreateInput, tx: Tx | typeof prisma = prisma): Promise<ActivityLog> {
    return withPrismaErrors('ActivityLog', () => tx.activityLog.create({ data }));
  },
};
