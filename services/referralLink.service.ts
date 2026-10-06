import { ActivityType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import {
  consultationFromReferral,
  mobileKey,
  prospectFromReferral,
  referralTarget,
  validateConsultationDetails,
} from '@/lib/growthPartner/crmLink';
import type { ReferralType } from '@/lib/growthPartner/rules';

// Growth Partner referral → CRM consultation / vendor prospect (lib/growthPartner/crmLink.ts, MASTER-GAP-ANALYSIS §2.4.3).
// Staff press "Add to CRM" once; the referral keeps the link and shows the real stage after that. Idempotent: a referral already
// sent answers with what it is linked to. An existing open record with the same mobile is linked instead of creating a duplicate.

export interface ReferralLinkDeps {
  db: Pick<typeof prisma, '$transaction'>;
}

const defaultDeps = (): ReferralLinkDeps => ({ db: prisma });

export interface ReferralLinkResult {
  target: 'CONSULTATION' | 'VENDOR_PROSPECT';
  id: string;
  created: boolean; // false = linked to an existing record with the same mobile
}

export function createReferralLinkService(deps: ReferralLinkDeps = defaultDeps()) {
  return {
    async sendToCrm(referralId: string, input: { weddingDate?: unknown; guestCount?: unknown }, actorId: string | null): Promise<ReferralLinkResult> {
      return deps.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "partner_referrals" WHERE "id" = ${referralId} FOR UPDATE`;
        const r = await tx.partnerReferral.findUnique({ where: { id: referralId }, include: { partner: { select: { code: true } } } });
        if (!r) throw new NotFoundError('Referral', referralId);
        if (r.consultationId) return { target: 'CONSULTATION', id: r.consultationId, created: false };
        if (r.vendorProspectId) return { target: 'VENDOR_PROSPECT', id: r.vendorProspectId, created: false };
        if (r.status === 'REJECTED') throw new ConflictError('This referral was rejected — reopen it before adding it to the CRM');

        const target = referralTarget(r.type as ReferralType);
        if (!target) throw new ConflictError('Event referrals are not added to the CRM yet — follow them up from this list');
        const key = mobileKey(r.phone);

        if (target === 'CONSULTATION') {
          const details = validateConsultationDetails(input);
          if ('error' in details) throw new ValidationError(details.error);
          // An open consultation for the same mobile: link it instead of making a second one.
          const existing = await tx.consultation.findFirst({
            where: { phone: { endsWith: key }, pipelineStage: { notIn: ['LOST', 'WON'] }, partnerReferral: null },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
          });
          const consultationId = existing?.id ?? (await tx.consultation.create({ data: consultationFromReferral(r, r.partner.code, details), select: { id: true } })).id;
          await tx.partnerReferral.update({ where: { id: r.id }, data: { consultationId } });
          await tx.activityLog.create({
            data: {
              type: ActivityType.STATUS_CHANGED,
              summary: existing
                ? `Growth Partner ${r.partner.code} referred this customer (${r.name}) — linked to this enquiry`
                : `Added from a Growth Partner referral (${r.partner.code})`,
              consultation: { connect: { id: consultationId } },
              performedBy: actorId ? { connect: { id: actorId } } : undefined,
            },
          });
          return { target, id: consultationId, created: !existing };
        }

        const existingProspect = await tx.vendorProspect.findFirst({ where: { phone: { endsWith: key }, partnerReferral: null }, select: { id: true } });
        const vendorProspectId = existingProspect?.id ?? (await tx.vendorProspect.create({ data: prospectFromReferral(r, r.partner.code), select: { id: true } })).id;
        await tx.partnerReferral.update({ where: { id: r.id }, data: { vendorProspectId } });
        return { target, id: vendorProspectId, created: !existingProspect };
      });
    },
  };
}

export const referralLinkService = createReferralLinkService();
