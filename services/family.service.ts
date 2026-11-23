import { ActivityType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { Role } from '@/lib/auth/roles';
import { coupleMobile } from '@/lib/customer/weddingLink';
import { FAMILY_ROLE_WORDS, familyMemberProblem, MAX_FAMILY_MEMBERS, type FamilyMemberInput, type FamilyRole } from '@/lib/customer/familyAccess';
import { hashLoginCode, newLoginCode } from '@/services/vendorLoginCode.service';
import { codeEventWrite } from '@/services/loginCodeEvent';

// Family access (23 Nov 2026, Client OS → Family). The couple (Wedding.customerId) adds family members with a role; each signs in to
// My Wedding with their own mobile + 6-digit code, the same sign-in as the couple. Callers run these inside asCoupleWedding(…, 'family'),
// so only the couple themselves manage family. Every change is written to the wedding's history with who made it.
//
// Safety:
//   - a number that is already a business sign-in (staff, venue, vendor) is never turned into a family login — mixing them would let
//     the couple hand out a code to someone's work account;
//   - a number that already has its own couple/family sign-in is linked as it is: no new code (they keep the code they chose);
//   - a brand-new number gets a code, shown to the couple ONCE to send on WhatsApp; the member is reminded to choose their own.

const VIA_FAMILY = 'My Wedding · Family';

export interface FamilyMemberView {
  id: string;
  name: string;
  relation: string | null;
  role: FamilyRole;
  roleLabel: string;
  mobile: string | null;
  signedInBefore: boolean; // they have set a code of their own (not only the one they were given)
}

async function log(weddingId: string, summary: string, actorId: string, db: Pick<typeof prisma, 'activityLog'> = prisma) {
  await db.activityLog.create({ data: { type: ActivityType.NOTE, summary, weddingId, performedById: actorId } });
}

export const familyService = {
  async list(weddingId: string): Promise<FamilyMemberView[]> {
    const rows = await prisma.weddingMember.findMany({
      where: { weddingId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, relation: true, role: true, user: { select: { phone: true, loginCodeGiven: true, loginCodeHash: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      relation: r.relation,
      role: r.role,
      roleLabel: FAMILY_ROLE_WORDS[r.role].label,
      mobile: r.user.phone,
      signedInBefore: !!r.user.loginCodeHash && !r.user.loginCodeGiven,
    }));
  },

  // Adds a family member. Returns the code only when a new sign-in was made for them (shown once).
  async add(weddingId: string, input: FamilyMemberInput, ownerId: string): Promise<{ member: FamilyMemberView; code: string | null; mobile: string }> {
    const mobile = coupleMobile(input.mobile);
    const problem = familyMemberProblem(input, mobile);
    if (problem || !mobile) throw new ValidationError(problem ?? 'Their mobile should be a 10-digit number');
    const role = input.role as FamilyRole;
    const name = input.name.trim();
    const relation = input.relation?.trim() || null;

    const result = await prisma.$transaction(async (tx) => {
      const wedding = await tx.wedding.findUnique({ where: { id: weddingId }, select: { id: true, customerId: true, customer: { select: { phone: true } } } });
      if (!wedding) throw new NotFoundError('Wedding', weddingId);
      if (wedding.customer?.phone === mobile) throw new ValidationError('That is your own number — you already have full access');
      if ((await tx.weddingMember.count({ where: { weddingId } })) >= MAX_FAMILY_MEMBERS) throw new ConflictError(`You can add up to ${MAX_FAMILY_MEMBERS} family members`);

      const existing = await tx.user.findUnique({ where: { phone: mobile }, select: { id: true, roles: { select: { role: true } }, _count: { select: { businessMemberships: true } } } });
      let userId: string;
      let code: string | null = null;
      if (existing) {
        const coupleOnly = existing.roles.every((r) => r.role === Role.CUSTOMER) && existing._count.businessMemberships === 0;
        if (!coupleOnly) throw new ConflictError('This number is used for a business sign-in. Please use another number, or ask Shaadi Shopping.');
        if (existing.id === wedding.customerId) throw new ValidationError('That is your own number — you already have full access');
        await tx.userRole.upsert({ where: { userId_role: { userId: existing.id, role: Role.CUSTOMER } }, create: { userId: existing.id, role: Role.CUSTOMER }, update: {} });
        userId = existing.id;
      } else {
        code = newLoginCode();
        userId = (
          await tx.user.create({
            data: { phone: mobile, name, loginCodeHash: await hashLoginCode(code), loginCodeSetAt: new Date(), loginCodeGiven: true, roles: { create: { role: Role.CUSTOMER } }, ...codeEventWrite({ kind: 'GIVEN', byUserId: ownerId, via: VIA_FAMILY }) },
            select: { id: true },
          })
        ).id;
      }
      const already = await tx.weddingMember.findUnique({ where: { weddingId_userId: { weddingId, userId } } });
      if (already) throw new ConflictError(`${already.name} is already in your family list`);
      const member = await tx.weddingMember.create({ data: { weddingId, userId, name, relation, role, addedById: ownerId } });
      await log(weddingId, `The couple added ${name}${relation ? ` (${relation})` : ''} to the family — ${FAMILY_ROLE_WORDS[role].label.toLowerCase()}`, ownerId, tx);
      return { memberId: member.id, code };
    }).catch((err) => {
      if ((err as { code?: string })?.code === 'P2002') throw new ConflictError('This person was just added — please reload');
      throw err;
    });
    const member = (await this.list(weddingId)).find((m) => m.id === result.memberId)!;
    return { member, code: result.code, mobile };
  },

  async changeRole(weddingId: string, memberId: string, role: string, ownerId: string): Promise<FamilyMemberView> {
    if (!(['FULL', 'PLANNING', 'VIEW'] as string[]).includes(role)) throw new ValidationError('Choose what they can do');
    const m = await prisma.weddingMember.findFirst({ where: { id: memberId, weddingId } });
    if (!m) throw new NotFoundError('WeddingMember', memberId);
    if (m.role !== role) {
      await prisma.$transaction(async (tx) => {
        await tx.weddingMember.update({ where: { id: memberId }, data: { role: role as FamilyRole } });
        await log(weddingId, `${m.name} can now: ${FAMILY_ROLE_WORDS[role as FamilyRole].label.toLowerCase()}`, ownerId, tx);
      });
    }
    return (await this.list(weddingId)).find((x) => x.id === memberId)!;
  },

  // Their access ends at once (every couple route re-checks membership). Their sign-in itself stays — it may open other weddings.
  async remove(weddingId: string, memberId: string, ownerId: string): Promise<{ removed: true }> {
    const m = await prisma.weddingMember.findFirst({ where: { id: memberId, weddingId } });
    if (!m) throw new NotFoundError('WeddingMember', memberId);
    await prisma.$transaction(async (tx) => {
      await tx.weddingMember.delete({ where: { id: memberId } });
      await log(weddingId, `The couple removed ${m.name} from the family`, ownerId, tx);
    });
    return { removed: true };
  },
};
