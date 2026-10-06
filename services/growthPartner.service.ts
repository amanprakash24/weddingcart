// Growth Partner Program (docs/wedding-os/14-growth-partner.md). Public registration and referral submission, and
// the staff view that answers: who is the partner, what did they refer, did it convert, what payout is due.
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import {
  applyReferralUpdate,
  nextPartnerCode,
  PARTNER_NOT_FOUND,
  validatePartnerUpdate,
  validateReferral,
  validateReferralUpdate,
  validateRegistration,
  type PartnerStatus,
  type Registration,
  type ReferralStatus,
  type ReferralType,
} from '@/lib/growthPartner/rules';

type Db = typeof prisma;

export interface GrowthPartnerDeps {
  db: {
    growthPartner: Pick<Db['growthPartner'], 'findUnique' | 'findMany' | 'update' | 'count'>;
    partnerReferral: Pick<Db['partnerReferral'], 'create' | 'findUnique' | 'findMany' | 'update' | 'count' | 'aggregate'>;
  };
  // Creates the partner with the next "GP-…" code, serialised so two registrations never get the same code.
  createPartnerWithNextCode: (data: Registration & { consentAt: Date }) => Promise<{ code: string }>;
  isStaff: (userId: string) => Promise<boolean>;
}

const isUniqueViolation = (err: unknown) => (err as { code?: string })?.code === 'P2002';

export function createGrowthPartnerService(deps: GrowthPartnerDeps) {
  const { db } = deps;

  return {
    // Public. A new partner gets their code (shown once, to save); an already-registered mobile gets the same polite
    // answer WITHOUT the code — so nobody can look up someone else's code by typing their number.
    async register(input: Record<string, unknown>, now = new Date()): Promise<{ status: 'registered'; code: string; firstName: string } | { status: 'already-registered' }> {
      const data = validateRegistration(input);
      if (await db.growthPartner.findUnique({ where: { phone: data.phone }, select: { id: true } })) return { status: 'already-registered' };
      try {
        const { code } = await deps.createPartnerWithNextCode({ ...data, consentAt: now });
        return { status: 'registered', code, firstName: data.name.split(' ')[0] };
      } catch (err) {
        if (isUniqueViolation(err)) return { status: 'already-registered' }; // two submissions raced on the same mobile
        throw err;
      }
    },

    // Public. The partner identifies themselves with their registered mobile + Partner code; any mismatch gets one
    // message. Returns nothing about the partner or the stored referral.
    async submitReferral(input: Record<string, unknown>, now = new Date()): Promise<{ status: 'received' }> {
      const r = validateReferral(input);
      const partner = await db.growthPartner.findUnique({ where: { phone: r.partnerPhone }, select: { id: true, code: true, status: true } });
      if (!partner || partner.code !== r.partnerCode) throw new ValidationError(PARTNER_NOT_FOUND);
      if (partner.status === 'REJECTED' || partner.status === 'INACTIVE') throw new ConflictError('Your Growth Partner account is not active. Please contact us.');
      await db.partnerReferral.create({
        data: {
          partner: { connect: { id: partner.id } },
          type: r.type,
          name: r.name,
          phone: r.phone,
          city: r.city,
          requirement: r.requirement,
          notes: r.notes,
          consentAt: now,
        },
      });
      return { status: 'received' };
    },

    // ---- staff ----

    async listPartners(filters: { status?: PartnerStatus; city?: string } = {}) {
      return db.growthPartner.findMany({
        where: { ...(filters.status ? { status: filters.status } : {}), ...(filters.city ? { city: { equals: filters.city, mode: 'insensitive' } } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 500,
        include: { _count: { select: { referrals: true } } },
      });
    },

    async updatePartner(id: string, input: Record<string, unknown>) {
      const update = validatePartnerUpdate(input);
      if (!(await db.growthPartner.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundError('Growth partner', id);
      return db.growthPartner.update({ where: { id }, data: update });
    },

    async listReferrals(filters: { status?: ReferralStatus; type?: ReferralType; partnerId?: string } = {}) {
      return db.partnerReferral.findMany({
        where: { ...(filters.status ? { status: filters.status } : {}), ...(filters.type ? { type: filters.type } : {}), ...(filters.partnerId ? { partnerId: filters.partnerId } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 500,
        include: {
          partner: { select: { id: true, code: true, name: true, phone: true } },
          assignedTo: { select: { id: true, name: true } },
          // Where it went (MASTER-GAP-ANALYSIS §2.4.3): the CRM stage and, once booked, the wedding.
          consultation: { select: { id: true, pipelineStage: true, wedding: { select: { weddingNumber: true } } } },
          vendorProspect: { select: { id: true, status: true } },
        },
      });
    },

    async updateReferral(id: string, input: Record<string, unknown>, now = new Date()) {
      const update = validateReferralUpdate(input);
      const current = await db.partnerReferral.findUnique({ where: { id }, select: { status: true, payoutStatus: true, payoutAmount: true, completedAt: true, paidAt: true } });
      if (!current) throw new NotFoundError('Referral', id);
      if (update.assignedToId && !(await deps.isStaff(update.assignedToId))) throw new ValidationError('Assign the referral to a team member');
      const next = applyReferralUpdate(current, update, now);
      return db.partnerReferral.update({
        where: { id },
        data: {
          ...next,
          ...(update.assignedToId !== undefined ? { assignedTo: update.assignedToId ? { connect: { id: update.assignedToId } } : { disconnect: true } } : {}),
          ...(update.staffNotes !== undefined ? { staffNotes: update.staffNotes } : {}),
        },
      });
    },

    // The four V1 questions, as numbers.
    async stats() {
      const [partners, activePartners, newReferrals, converted, completed, due, paid] = await Promise.all([
        db.growthPartner.count(),
        db.growthPartner.count({ where: { status: 'APPROVED' } }),
        db.partnerReferral.count({ where: { status: 'SUBMITTED' } }),
        db.partnerReferral.count({ where: { status: { in: ['CONVERTED', 'COMPLETED', 'PAID'] } } }),
        db.partnerReferral.count({ where: { status: { in: ['COMPLETED', 'PAID'] } } }),
        db.partnerReferral.aggregate({ where: { payoutStatus: 'DUE' }, _sum: { payoutAmount: true } }),
        db.partnerReferral.aggregate({ where: { payoutStatus: 'PAID' }, _sum: { payoutAmount: true } }),
      ]);
      return { partners, activePartners, newReferrals, converted, completed, payoutsDue: due._sum.payoutAmount ?? 0, totalPaid: paid._sum.payoutAmount ?? 0 };
    },
  };
}

function defaultDeps(): GrowthPartnerDeps {
  return {
    db: prisma,
    createPartnerWithNextCode: (data) =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('GROWTH_PARTNER_CODE', 0))`;
        const last = await tx.growthPartner.findFirst({ orderBy: { createdAt: 'desc' }, select: { code: true } });
        const code = nextPartnerCode(last?.code ?? null);
        await tx.growthPartner.create({ data: { ...data, code } });
        return { code };
      }),
    isStaff: async (userId) => !!(await prisma.user.findFirst({ where: { id: userId, roles: { some: { role: { in: ADMIN_ROLES } } } }, select: { id: true } })),
  };
}

export const growthPartnerService = createGrowthPartnerService(defaultDeps());
