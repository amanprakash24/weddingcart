import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { effectiveScope } from '@/lib/ownership/scope';
import { ASSIGNABLE_ROLES, can, effectivePermissions, type MemberRole } from '@/lib/auth/permissions';
import { ADMIN_ROLES, Role } from '@/lib/auth/roles';
import { hashLoginCode, newLoginCode } from '@/services/vendorLoginCode.service';
import { checkChange, checkNewMember, checkOwnName, memberPermissions, TEAM_LIMITS, type AddResult, type TeamErrors, type TeamMemberView, type TeamView } from '@/lib/venue/team';

// The Team screen (lib/venue/team.ts): who works in the business, and the owner adding, changing and removing them. Always called
// inside the business's scope (lib/ownership/venueEntry.ts), behind the `team` permission. Business and BusinessMember are not
// owned tables, so every read and write here names the business from the scope — never one named by a request.
//
// Logins (services/vendorLoginCode.service.ts):
//   - a NEW mobile number → a new login with the vendor door (Role.VENDOR) and a fresh 6-digit code, returned this once;
//   - a number that already signs in with its own code → only the membership; that code is theirs and is never replaced;
//   - an account with NO code (a couple who signs in by WhatsApp, a team member with a password) → only the membership, and NO code
//     is issued: whoever issues a code can sign in with it, so an owner must never get one for an account that is not new.
// Taking someone out of the team (removedAt) ends their access at once: every request re-checks the membership.

export interface VenueTeamDeps {
  db: typeof prisma;
  hash: (code: string) => Promise<string>;
  newCode: () => string;
  now: () => Date;
}

const defaultDeps = (): VenueTeamDeps => ({ db: prisma, hash: hashLoginCode, newCode: newLoginCode, now: () => new Date() });

const memberSelect = { id: true, role: true, jobTitle: true, grants: true, denies: true, userId: true, user: { select: { name: true, phone: true } } } as const;
type MemberRow = { id: string; role: MemberRole; jobTitle: string | null; grants: string[]; denies: string[]; userId: string; user: { name: string | null; phone: string | null } };

export function createVenueTeamService(deps: VenueTeamDeps = defaultDeps()) {
  function scope() {
    const s = effectiveScope();
    if (s.kind !== 'BUSINESS' || !can(s, 'team')) throw new NotFoundError('Team', 'current');
    return s;
  }

  const view = (m: MemberRow, me: string): TeamMemberView => {
    const seesMoney = effectivePermissions({ role: m.role, grants: m.grants, denies: m.denies }).includes('view_financials');
    return { id: m.id, name: m.user.name, mobile: m.user.phone, role: m.role, jobTitle: m.jobTitle, seesMoney, isYou: m.userId === me, canChange: m.role !== 'OWNER' && m.userId !== me };
  };

  async function memberOf(businessId: string, memberId: string) {
    const m = await deps.db.businessMember.findFirst({ where: { id: memberId, businessId, removedAt: null }, select: memberSelect });
    if (!m) throw new NotFoundError('Team member', memberId);
    return m as MemberRow;
  }

  // Someone may only let others see money if they see it themselves.
  function moneyAllowed(s: ReturnType<typeof scope>, wanted: boolean): TeamErrors | null {
    return wanted && !can(s, 'view_financials') ? { seesMoney: 'Only someone who can see money can let others see it' } : null;
  }

  return {
    async list(): Promise<TeamView> {
      const s = scope();
      const rows = (await deps.db.businessMember.findMany({ where: { businessId: s.businessId, removedAt: null }, select: memberSelect, orderBy: { createdAt: 'asc' } })) as MemberRow[];
      const members = rows.map((m) => view(m, s.userId ?? '')).sort((a, b) => Number(b.role === 'OWNER') - Number(a.role === 'OWNER'));
      const business = await deps.db.business.findUnique({ where: { id: s.businessId }, select: { name: true } });
      return { members, businessName: business?.name ?? '', canGiveMoney: can(s, 'view_financials'), roles: ASSIGNABLE_ROLES };
    },

    async add(input: Record<string, unknown>): Promise<AddResult | { errors: TeamErrors }> {
      const s = scope();
      const checked = checkNewMember(input);
      if (!checked.ok) return { errors: checked.errors };
      const v = checked.value;
      const refused = moneyAllowed(s, v.seesMoney);
      if (refused) return { errors: refused };
      if ((await deps.db.businessMember.count({ where: { businessId: s.businessId, removedAt: null } })) >= TEAM_LIMITS.members) {
        throw new ConflictError(`A team can have up to ${TEAM_LIMITS.members} people — remove someone to add another`);
      }
      const perms = memberPermissions(v.role, v.seesMoney);

      return deps.db.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({ where: { phone: v.mobile }, select: { id: true, loginCodeHash: true, roles: { select: { role: true } } } });
        let code: string | null = null;
        let userId: string;
        if (existing) {
          userId = existing.id;
        } else {
          code = deps.newCode();
          try {
            userId = (await tx.user.create({ data: { phone: v.mobile, name: v.name, loginCodeHash: await deps.hash(code), loginCodeSetAt: deps.now() }, select: { id: true } })).id;
          } catch (err) {
            if ((err as { code?: string })?.code === 'P2002') throw new ConflictError('Someone signed up with this number a moment ago — please try again');
            throw err;
          }
        }
        // The vendor door (/vendor). A person on Shaadi Shopping's own team keeps their team roles as they are.
        await tx.userRole.upsert({ where: { userId_role: { userId, role: Role.VENDOR } }, create: { userId, role: Role.VENDOR }, update: {} });

        const was = await tx.businessMember.findUnique({ where: { businessId_userId: { businessId: s.businessId, userId } }, select: { id: true, removedAt: true } });
        if (was && !was.removedAt) throw new ConflictError('This person is already in your team');
        const data = { role: v.role, jobTitle: v.jobTitle, grants: perms.grants, denies: perms.denies, removedAt: null };
        const row = (was
          ? await tx.businessMember.update({ where: { id: was.id }, data, select: memberSelect })
          : await tx.businessMember.create({ data: { ...data, businessId: s.businessId, userId }, select: memberSelect })) as MemberRow;
        const member = view(row, s.userId ?? '');

        if (code) return { kind: 'NEW_LOGIN' as const, member, code };
        const onTeam = existing!.roles.some((r) => ADMIN_ROLES.includes(r.role));
        return existing!.loginCodeHash || onTeam ? { kind: 'EXISTING_LOGIN' as const, member } : { kind: 'NEEDS_CODE' as const, member };
      });
    },

    async change(memberId: string, input: Record<string, unknown>): Promise<TeamMemberView | { errors: TeamErrors }> {
      const s = scope();
      const m = await memberOf(s.businessId, memberId);
      if (m.role === 'OWNER' || m.userId === s.userId) throw new ConflictError(m.role === 'OWNER' ? 'An owner cannot be changed here' : 'You cannot change your own access');
      const checked = checkChange(input);
      if (!checked.ok) return { errors: checked.errors };
      const refused = moneyAllowed(s, checked.value.seesMoney);
      if (refused) return { errors: refused };
      const perms = memberPermissions(checked.value.role, checked.value.seesMoney, m.role === checked.value.role ? m : undefined);
      const row = (await deps.db.businessMember.update({ where: { id: m.id }, data: { role: checked.value.role, jobTitle: checked.value.jobTitle, grants: perms.grants, denies: perms.denies }, select: memberSelect })) as MemberRow;
      return view(row, s.userId ?? '');
    },

    // "Your name": the signed-in person names themselves — nobody else, and no permission is needed for one's own name. It is
    // the name on their own account (the person, not the membership). The person comes from the scope, never from the request.
    async setMyName(raw: unknown): Promise<{ name: string } | { errors: TeamErrors }> {
      const s = effectiveScope();
      if (s.kind !== 'BUSINESS' || !s.userId) throw new NotFoundError('Team', 'current');
      const checked = checkOwnName(raw);
      if (!checked.ok) return { errors: { name: checked.error } };
      await deps.db.user.update({ where: { id: s.userId }, data: { name: checked.name } });
      return { name: checked.name };
    },

    // Out of the team: access ends at once; what they did still names them.
    async remove(memberId: string): Promise<{ removed: true }> {
      const s = scope();
      const m = await memberOf(s.businessId, memberId);
      if (m.role === 'OWNER' || m.userId === s.userId) throw new ConflictError(m.role === 'OWNER' ? 'An owner cannot be removed here' : 'You cannot remove yourself');
      await deps.db.businessMember.update({ where: { id: m.id }, data: { removedAt: deps.now() } });
      return { removed: true };
    },
  };
}

export const venueTeamService = createVenueTeamService();

