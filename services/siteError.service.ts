import { Prisma } from '@/generated/prisma/client';
import { siteErrorRepository } from '@/repositories/siteError.repository';
import { NotFoundError } from '@/lib/errors';
import type { CleanSiteError } from '@/lib/siteErrors/normalize';

// Site errors (25 Oct 2026): one row per kind of problem (lib/siteErrors/normalize.ts makes the fingerprint), shown on
// /admin/errors. A flood of DIFFERENT new problems stops adding rows after MAX_OPEN; repeats of known ones are still counted.
export const MAX_OPEN = 300;

export const siteErrorService = {
  async record(error: CleanSiteError): Promise<void> {
    const known = await siteErrorRepository.findByFingerprint(error.fingerprint);
    if (known) {
      await siteErrorRepository.bump(error.fingerprint, { detail: error.detail, lastBrowser: error.browser });
      return;
    }
    if ((await siteErrorRepository.count({ resolvedAt: null })) >= MAX_OPEN) return;
    try {
      await siteErrorRepository.create({
        fingerprint: error.fingerprint,
        source: error.source,
        message: error.message,
        location: error.location,
        detail: error.detail,
        lastBrowser: error.browser,
      });
    } catch (err) {
      // Two requests hit the same new problem at once: the other one created the row, so count this one on it.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        await siteErrorRepository.bump(error.fingerprint, { detail: error.detail, lastBrowser: error.browser });
        return;
      }
      throw err;
    }
  },

  list(status: 'open' | 'fixed') {
    return siteErrorRepository.findMany({ where: status === 'open' ? { resolvedAt: null } : { resolvedAt: { not: null } } });
  },

  /** Problems still open that happened in the last 7 days — the number on the admin Today page. */
  countRecentOpen(now = new Date()) {
    return siteErrorRepository.count({ resolvedAt: null, lastSeenAt: { gte: new Date(now.getTime() - 7 * 24 * 3600 * 1000) } });
  },

  async setFixed(id: string, fixed: boolean) {
    try {
      return await siteErrorRepository.setResolved(id, fixed ? new Date() : null);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') throw new NotFoundError('SiteError', id);
      throw err;
    }
  },
};
