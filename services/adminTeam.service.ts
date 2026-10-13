import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { ADMIN_ROLES, Role } from '@/lib/auth/roles';
import { normalizeMobile } from '@/lib/auth/vendorCode';
import { PLATFORM_BUSINESS_ID } from '@/lib/ownership/owned';
import { hashLoginCode, newLoginCode } from '@/services/vendorLoginCode.service';
import { checkName, checkNewTeamMember, isTeamRole, OUR_TEAM_LIMITS, type OurTeamErrors, type OurTeamMember, type TeamRole } from '@/lib/admin/ourTeam';

// "Our team" (lib/admin/ourTeam.ts): Shaadi Shopping's own people — who they are, and the founder adding, naming, re-coding and
// removing them. Every call names the ACTOR (the signed-in person, from the session — never from the request) and is refused
// unless that person is a founder (SUPER_ADMIN) right now, read from the database rather than trusted from the session.
//
// Logins (services/vendorLoginCode.service.ts — mobile number + 6-digit code, the same for everyone):
//   - a NEW mobile number → a new login with the chosen role and a fresh code, returned this once;
//   - a number that is ALREADY SOMEONE'S LOGIN (a vendor, a couple) → refused. Knowing a number proves nothing, and whoever holds
//     that login would walk into the Command Center with it. (A team member links their own second number in My sign-in, with
//     that login's code as proof — services/teamLogin.service.ts.)
//   - a founder's own sign-in is never changed from here, by anyone — not their number, not their code, not their role. A new
//     code is a way to sign in AS that person; for Sales / Operations that gives a founder nothing they do not already have.
// Removing someone ends their access at once: their team roles go, their membership is closed, and every device is signed out.

export interface AdminTeamDeps {
  db: typeof prisma;
  hash: (code: string) => Promise<string>;
  newCode: () => string;
  now: () => Date;
}

const defaultDeps = (): AdminTeamDeps => ({ db: prisma, hash: hashLoginCode, newCode: newLoginCode, now: () => new Date() });

const personSelect = {
  id: true, name: true, email: true, phone: true, image: true, passwordHash: true, loginCodeHash: true,
  roles: { select: { role: true } },
  businessMemberships: { where: { businessId: PLATFORM_BUSINESS_ID }, select: { jobTitle: true } },
} as const;
type PersonRow = { id: string; name: string | null; email: string | null; phone: string | null; image: string | null; passwordHash: string | null; loginCodeHash: string | null; roles: { role: Role }[]; businessMemberships: { jobTitle: string | null }[] };

// What a Sales / Operations person is in the Shaadi Shopping business — the same as the people who were there before this screen
// (migration 20261007100100): a manager who sees and records money.
const TEAM_MEMBERSHIP = { role: 'MANAGER' as const, grants: ['view_financials', 'edit_financials'] };

const teamRoleOf = (roles: { role: Role }[]): OurTeamMember['role'] | null => {
  const held = roles.map((r) => r.role);
  if (held.includes(Role.SUPER_ADMIN)) return 'SUPER_ADMIN';
  if (held.includes(Role.OPERATIONS)) return 'OPERATIONS';
  if (held.includes(Role.SALES)) return 'SALES';
  return null;
};

export function createAdminTeamService(deps: AdminTeamDeps = defaultDeps()) {
  async function founder(actorId: string) {
    const me = await deps.db.user.findUnique({ where: { id: actorId }, select: { id: true, roles: { select: { role: true } } } });
    if (!me || !me.roles.some((r) => r.role === Role.SUPER_ADMIN)) throw new NotFoundError('Team', 'current');
    return me;
  }

  const view = (p: PersonRow, me: string): OurTeamMember => {
    const role = teamRoleOf(p.roles)!;
    return { id: p.id, name: p.name, designation: p.businessMemberships[0]?.jobTitle ?? null, photoUrl: p.image, email: p.email, mobile: p.phone, role, hasCode: p.loginCodeHash !== null, hasPassword: p.passwordHash !== null, isYou: p.id === me, canManage: role !== 'SUPER_ADMIN' };
  };

  // Someone on the team who is not a founder — the only people whose sign-in and place in the team are managed here.
  async function manageable(userId: string) {
    const p = (await deps.db.user.findUnique({ where: { id: userId }, select: personSelect })) as PersonRow | null;
    const role = p ? teamRoleOf(p.roles) : null;
    if (!p || !role) throw new NotFoundError('Team member', userId);
    if (role === 'SUPER_ADMIN') throw new ConflictError('A founder’s sign-in can only be changed by that founder, in My sign-in');
    return p;
  }

  return {
    async list(actorId: string): Promise<OurTeamMember[]> {
      await founder(actorId);
      const rows = (await deps.db.user.findMany({ where: { roles: { some: { role: { in: ADMIN_ROLES } } } }, select: personSelect, orderBy: { createdAt: 'asc' } })) as PersonRow[];
      return rows.map((p) => view(p, actorId)).sort((a, b) => Number(b.role === 'SUPER_ADMIN') - Number(a.role === 'SUPER_ADMIN'));
    },

    async add(actorId: string, input: Record<string, unknown>): Promise<{ member: OurTeamMember; code: string } | { errors: OurTeamErrors }> {
      await founder(actorId);
      const checked = checkNewTeamMember(input);
      if (!checked.ok) return { errors: checked.errors };
      const v = checked.value;
      if ((await deps.db.user.count({ where: { roles: { some: { role: { in: ADMIN_ROLES } } } } })) >= OUR_TEAM_LIMITS.members) {
        throw new ConflictError(`The team can have up to ${OUR_TEAM_LIMITS.members} people — remove someone to add another`);
      }

      return deps.db.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
          where: { phone: v.mobile },
          select: { id: true, roles: { select: { role: true } }, vendorProfile: { select: { id: true } }, businessMemberships: { where: { removedAt: null }, select: { id: true } } },
        });
        if (existing && teamRoleOf(existing.roles)) throw new ConflictError('This person is already in the team');
        // A login that opens anything at all is somebody's: it is never handed the Command Center on the strength of its number.
        // One that opens nothing (someone taken out of the team earlier) can come back, with a new code.
        if (existing && (existing.roles.length > 0 || existing.vendorProfile || existing.businessMemberships.length > 0)) {
          throw new ConflictError('This mobile number already signs in to Shaadi Shopping as someone else (a vendor or a customer). Use a number that is not a login yet.');
        }

        const code = deps.newCode();
        const login = { name: v.name, loginCodeHash: await deps.hash(code), loginCodeSetAt: deps.now() };
        let userId: string;
        if (existing) {
          userId = (await tx.user.update({ where: { id: existing.id }, data: { ...login, sessionVersion: { increment: 1 } }, select: { id: true } })).id;
        } else {
          try {
            userId = (await tx.user.create({ data: { ...login, phone: v.mobile }, select: { id: true } })).id;
          } catch (err) {
            if ((err as { code?: string })?.code === 'P2002') throw new ConflictError('Someone signed up with this number a moment ago — please try again');
            throw err;
          }
        }
        await tx.userRole.create({ data: { userId, role: v.role } });
        await tx.businessMember.upsert({
          where: { businessId_userId: { businessId: PLATFORM_BUSINESS_ID, userId } },
          create: { businessId: PLATFORM_BUSINESS_ID, userId, ...TEAM_MEMBERSHIP },
          update: { ...TEAM_MEMBERSHIP, denies: [], removedAt: null },
        });
        const row = (await tx.user.findUniqueOrThrow({ where: { id: userId }, select: personSelect })) as PersonRow;
        console.info(`[our-team] ${actorId} added ${userId} as ${v.role}`);
        return { member: view(row, actorId), code };
      });
    },

    // A name for anyone on the team — the founder's own included. It is the name on the person's account.
    async rename(actorId: string, userId: string, raw: unknown): Promise<OurTeamMember | { errors: OurTeamErrors }> {
      await founder(actorId);
      const p = (await deps.db.user.findUnique({ where: { id: userId }, select: personSelect })) as PersonRow | null;
      if (!p || !teamRoleOf(p.roles)) throw new NotFoundError('Team member', userId);
      const checked = checkName(raw);
      if (!checked.ok) return { errors: { name: checked.error } };
      const row = (await deps.db.user.update({ where: { id: userId }, data: { name: checked.name }, select: personSelect })) as PersonRow;
      return view(row, actorId);
    },

    async setRole(actorId: string, userId: string, role: unknown): Promise<OurTeamMember | { errors: OurTeamErrors }> {
      await founder(actorId);
      const p = await manageable(userId);
      if (!isTeamRole(role)) return { errors: { role: 'Sales or Operations' } };
      const other: TeamRole = role === 'SALES' ? 'OPERATIONS' : 'SALES';
      await deps.db.$transaction([
        deps.db.userRole.upsert({ where: { userId_role: { userId: p.id, role } }, create: { userId: p.id, role }, update: {} }),
        deps.db.userRole.deleteMany({ where: { userId: p.id, role: other } }),
        // The role is in the session they already hold — sign them out so the new one is what they work with.
        deps.db.user.update({ where: { id: p.id }, data: { sessionVersion: { increment: 1 } } }),
      ]);
      console.info(`[our-team] ${actorId} made ${p.id} ${role}`);
      return view((await deps.db.user.findUniqueOrThrow({ where: { id: p.id }, select: personSelect })) as PersonRow, actorId);
    },

    // A new 6-digit code — and, when `mobile` is given, a new mobile number with it (a wrong number, or a person who had none).
    // The old code stops working and the person is signed out everywhere. The code is readable in this one answer only.
    async issueCode(actorId: string, userId: string, mobileInput?: unknown): Promise<{ member: OurTeamMember; code: string } | { errors: OurTeamErrors }> {
      await founder(actorId);
      const p = await manageable(userId);
      let phone = p.phone;
      if (mobileInput !== undefined && mobileInput !== null && mobileInput !== '') {
        const mobile = normalizeMobile(mobileInput);
        if (!mobile) return { errors: { mobile: 'A 10-digit Indian mobile number' } };
        if (mobile !== p.phone && (await deps.db.user.findUnique({ where: { phone: mobile }, select: { id: true } }))) {
          return { errors: { mobile: 'This mobile number is already someone’s login' } };
        }
        phone = mobile;
      }
      if (!phone) return { errors: { mobile: 'Their mobile number — they have none yet' } };
      const code = deps.newCode();
      let row: PersonRow;
      try {
        row = (await deps.db.user.update({
          where: { id: p.id },
          data: { phone, loginCodeHash: await deps.hash(code), loginCodeSetAt: deps.now(), sessionVersion: { increment: 1 } },
          select: personSelect,
        })) as PersonRow;
      } catch (err) {
        if ((err as { code?: string })?.code === 'P2002') return { errors: { mobile: 'This mobile number is already someone’s login' } };
        throw err;
      }
      console.info(`[our-team] ${actorId} issued a new code for ${p.id}${phone !== p.phone ? ' with a new mobile number' : ''}`);
      return { member: view(row, actorId), code };
    },

    // Out of the team: the Command Center closes for them at once. What they did still names them.
    async remove(actorId: string, userId: string): Promise<{ removed: true }> {
      await founder(actorId);
      const p = await manageable(userId);
      await deps.db.$transaction([
        deps.db.userRole.deleteMany({ where: { userId: p.id, role: { in: ADMIN_ROLES } } }),
        deps.db.businessMember.updateMany({ where: { businessId: PLATFORM_BUSINESS_ID, userId: p.id, removedAt: null }, data: { removedAt: deps.now() } }),
        deps.db.user.update({ where: { id: p.id }, data: { sessionVersion: { increment: 1 } } }),
      ]);
      console.info(`[our-team] ${actorId} removed ${p.id} from the team`);
      return { removed: true };
    },
  };
}

export const adminTeamService = createAdminTeamService();
