import { prisma } from '@/lib/prisma';
import type { SourceType } from '@/services/leadInbox.service';
import { canSeeCompanyFinancials } from '@/lib/auth/financialAccess';
import { sourceMoneyAccess, weddingMoneyAccess, type MoneyAccess, type Viewer } from '@/lib/auth/moneyAccess';

// Loads who a record is assigned to and answers "how much of its money may this person see?" (rules: lib/auth/moneyAccess.ts).
// The founder is answered without a database read. A record that does not exist is 'none' for the team — the route then refuses
// it the same way as someone else's record, so nothing is learned about which ids exist.

const sourceSelect = { assignedToId: true, wedding: { select: { coordinatorId: true } } } as const;

async function loadSource(sourceType: SourceType, id: string) {
  if (sourceType === 'LEAD') return prisma.lead.findUnique({ where: { id }, select: sourceSelect });
  if (sourceType === 'ENQUIRY') return prisma.enquiry.findUnique({ where: { id }, select: sourceSelect });
  return prisma.consultation.findUnique({ where: { id }, select: sourceSelect });
}

export const moneyAccessService = {
  async forWedding(viewer: Viewer, weddingId: string): Promise<MoneyAccess> {
    if (canSeeCompanyFinancials(viewer.roles)) return 'full';
    const wedding = await prisma.wedding.findUnique({
      where: { id: weddingId },
      select: {
        coordinatorId: true,
        sourceLead: { select: { assignedToId: true } },
        sourceEnquiry: { select: { assignedToId: true } },
        sourceConsultation: { select: { assignedToId: true } },
      },
    });
    if (!wedding) return 'none';
    const source = wedding.sourceLead ?? wedding.sourceEnquiry ?? wedding.sourceConsultation;
    return weddingMoneyAccess(viewer, { coordinatorId: wedding.coordinatorId, sourceAssignedToId: source?.assignedToId ?? null });
  },

  async forSource(viewer: Viewer, sourceType: SourceType, sourceId: string): Promise<MoneyAccess> {
    if (canSeeCompanyFinancials(viewer.roles)) return 'full';
    const source = await loadSource(sourceType, sourceId);
    if (!source) return 'none';
    return sourceMoneyAccess(viewer, { assignedToId: source.assignedToId, wedding: source.wedding });
  },

  async forQuotation(viewer: Viewer, quotationId: string): Promise<MoneyAccess> {
    if (canSeeCompanyFinancials(viewer.roles)) return 'full';
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      select: { leadId: true, enquiryId: true, consultationId: true },
    });
    if (!quotation) return 'none';
    if (quotation.leadId) return this.forSource(viewer, 'LEAD', quotation.leadId);
    if (quotation.enquiryId) return this.forSource(viewer, 'ENQUIRY', quotation.enquiryId);
    if (quotation.consultationId) return this.forSource(viewer, 'CONSULTATION', quotation.consultationId);
    return 'none';
  },
};
