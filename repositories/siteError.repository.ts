import { prisma } from '@/lib/prisma';
import { Prisma, type SiteError } from '@/generated/prisma/client';

type Tx = Prisma.TransactionClient;

// Site errors (25 Oct 2026). Standard interface per docs/repository-contract.md; rules live in services/siteError.service.ts.
export const siteErrorRepository = {
  async findByFingerprint(fingerprint: string, tx: Tx | typeof prisma = prisma): Promise<SiteError | null> {
    return tx.siteError.findUnique({ where: { fingerprint } });
  },

  async create(data: Prisma.SiteErrorCreateInput, tx: Tx | typeof prisma = prisma): Promise<SiteError> {
    return tx.siteError.create({ data });
  },

  /** One more time: count +1, seen now, open again if it was marked fixed. */
  async bump(fingerprint: string, latest: { detail: string | null; lastBrowser: string | null }, tx: Tx | typeof prisma = prisma): Promise<SiteError> {
    return tx.siteError.update({
      where: { fingerprint },
      data: {
        count: { increment: 1 },
        lastSeenAt: new Date(),
        resolvedAt: null,
        ...(latest.detail ? { detail: latest.detail } : {}),
        ...(latest.lastBrowser ? { lastBrowser: latest.lastBrowser } : {}),
      },
    });
  },

  async findMany(params: { where?: Prisma.SiteErrorWhereInput; take?: number }, tx: Tx | typeof prisma = prisma): Promise<SiteError[]> {
    return tx.siteError.findMany({ where: params.where, orderBy: { lastSeenAt: 'desc' }, take: params.take ?? 200 });
  },

  async count(where?: Prisma.SiteErrorWhereInput, tx: Tx | typeof prisma = prisma): Promise<number> {
    return tx.siteError.count({ where });
  },

  async setResolved(id: string, resolvedAt: Date | null, tx: Tx | typeof prisma = prisma): Promise<SiteError> {
    return tx.siteError.update({ where: { id }, data: { resolvedAt } });
  },
};
