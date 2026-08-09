import { leadRepository } from '@/repositories/lead.repository';
import { findWeddingForSource } from '@/services/weddingConversion.service';
import { ConversionLockedError } from '@/lib/errors';
import type { Prisma } from '@/generated/prisma/client';

export const leadService = {
  async list() {
    return leadRepository.findMany({ orderBy: { createdAt: 'desc' } });
  },

  create: (data: Prisma.LeadCreateInput) => leadRepository.create(data),

  // Blocks deletion once a Lead has converted to a Wedding — reuses the same
  // conversion check leadWorkspaceService's assertNotConverted relies on
  // (findWeddingForSource queries Wedding.sourceLeadId directly, the real
  // relationship, not an assumed flag on Lead). Task/ActivityLog/Quotation/
  // LeadInsight.leadId and Wedding.sourceLeadId are all optional, unguarded
  // relations — Prisma's default onDelete for those is SetNull, so without
  // this check a delete would silently sever a converted Wedding's link back
  // to its originating lead instead of being refused.
  async delete(id: string) {
    const wedding = await findWeddingForSource('LEAD', id);
    if (wedding) {
      throw new ConversionLockedError(
        `Cannot delete: this lead converted to Wedding ${wedding.weddingNumber}`
      );
    }
    return leadRepository.delete(id);
  },
};
