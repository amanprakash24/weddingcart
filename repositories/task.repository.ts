import { prisma } from '@/lib/prisma';
import { Prisma, type Task } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

export interface FindManyParams {
  where?: Prisma.TaskWhereInput;
  skip?: number;
  take?: number;
  orderBy?: Prisma.TaskOrderByWithRelationInput;
}

export const taskRepository = {
  async findById(id: string, tx: Tx | typeof prisma = prisma): Promise<Task | null> {
    return tx.task.findUnique({ where: { id } });
  },

  async findMany(
    { where, skip, take, orderBy }: FindManyParams,
    tx: Tx | typeof prisma = prisma
  ): Promise<{ data: Task[]; total: number }> {
    const [data, total] = await Promise.all([
      tx.task.findMany({ where, skip, take, orderBy }),
      tx.task.count({ where }),
    ]);
    return { data, total };
  },

  async create(data: Prisma.TaskCreateInput, tx: Tx | typeof prisma = prisma): Promise<Task> {
    return withPrismaErrors('Task', () => tx.task.create({ data }));
  },

  async update(id: string, data: Prisma.TaskUpdateInput, tx: Tx | typeof prisma = prisma): Promise<Task> {
    return withPrismaErrors('Task', () => tx.task.update({ where: { id }, data }));
  },

  async delete(id: string, tx: Tx | typeof prisma = prisma): Promise<Task> {
    return withPrismaErrors('Task', () => tx.task.delete({ where: { id } }));
  },
};
