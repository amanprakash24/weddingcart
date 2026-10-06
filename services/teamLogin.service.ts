import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { isRateLimited, recordLoginAttempt } from '@/lib/auth/rateLimit';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { normalizeMobile } from '@/lib/auth/vendorCode';
import { PLATFORM_BUSINESS_ID } from '@/lib/ownership/owned';
import { vendorLoginCodeService } from '@/services/vendorLoginCode.service';

// "My sign-in" for Shaadi Shopping's own team (7 Oct 2026): a team member — the founder first — registers THEIR OWN mobile number
// and gets their own 6-digit code, so they can sign in the way everyone does (mobile number + code). The number is typed on a
// screen, by the person, while they are signed in; it is never written in the source code. Email + password keeps working.
//
// Safety, because this hands out Command Center access:
//   - only a signed-in member of the internal team, and only for THEMSELVES (never "give access to someone else's account");
//   - their current password is asked again (when they have one), with the usual 5-wrong-tries lock;
//   - a number that already belongs to another person (say, the same founder's vendor login) is linked only after they are told
//     whose it is and confirm — and that person's access is the SAME as theirs, never more;
//   - a fresh code is always issued, so only the person at this screen knows it — an older code on that number stops working.
//
// What "linking" means: the person with that mobile number is given the same internal roles and the same membership of the Shaadi
// Shopping business as the team member. One person, several memberships — not a second account that is the same human.

const mask = (mobile: string) => `${mobile.slice(0, 2)}******${mobile.slice(-2)}`;

export interface TeamLoginDeps {
  db: Pick<typeof prisma, 'user' | 'userRole' | 'businessMember'>;
  isLocked: typeof isRateLimited;
  record: typeof recordLoginAttempt;
  comparePassword: (password: string, hash: string) => Promise<boolean>;
  issueCode: (userId: string) => Promise<{ code: string; mobile: string | null }>;
}

const defaultDeps = (): TeamLoginDeps => ({
  db: prisma,
  isLocked: isRateLimited,
  record: recordLoginAttempt,
  comparePassword: (password, hash) => bcrypt.compare(password, hash),
  issueCode: (userId) => vendorLoginCodeService.issueForUser(userId),
});

export type LinkResult =
  | { code: string; mobile: string } // done — the code is shown once
  | { confirm: { mobile: string; belongsTo: string } } // that number is another person's: say so and ask
  | { errors: Partial<Record<'mobile' | 'password', string>> };

export function createTeamLoginService(deps: TeamLoginDeps = defaultDeps()) {
  async function teamMember(userId: string) {
    const me = await deps.db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, phone: true, passwordHash: true, loginCodeSetAt: true, roles: { select: { role: true } } } });
    if (!me) throw new NotFoundError('Login', userId);
    const internal = me.roles.map((r) => r.role).filter((r) => ADMIN_ROLES.includes(r));
    if (internal.length === 0) throw new NotFoundError('Login', userId); // not the internal team — nothing here is for them
    return { ...me, internal };
  }

  return {
    // What the "My sign-in" card shows. The number is masked — the screen never needs the whole of it.
    async status(userId: string): Promise<{ mobile: string | null; hasCode: boolean; hasPassword: boolean }> {
      const me = await teamMember(userId);
      return { mobile: me.phone ? mask(me.phone) : null, hasCode: me.loginCodeSetAt !== null, hasPassword: me.passwordHash !== null };
    },

    // Register (or change) my mobile number and get my code.
    async linkMobile(userId: string, input: { mobile?: unknown; password?: unknown; confirmExisting?: unknown }): Promise<LinkResult> {
      const me = await teamMember(userId);
      const mobile = normalizeMobile(input.mobile);
      if (!mobile) return { errors: { mobile: 'Enter your 10-digit mobile number' } };

      // Their password again — this screen gives out a way in to the Command Center.
      if (me.passwordHash) {
        const lock = `team-login-link:${userId}`;
        if (await deps.isLocked(lock)) throw new ConflictError('Too many wrong tries — please wait 15 minutes and try again');
        const ok = typeof input.password === 'string' && input.password.length > 0 && (await deps.comparePassword(input.password, me.passwordHash));
        await deps.record(lock, ok);
        if (!ok) return { errors: { password: 'That is not your current password' } };
      }

      const holder = await deps.db.user.findUnique({ where: { phone: mobile }, select: { id: true, name: true, vendorProfile: { select: { vendor: { select: { name: true } } } } } });

      // Nobody has this number: it becomes mine, on my own account.
      if (!holder) {
        await deps.db.user.update({ where: { id: me.id }, data: { phone: mobile } });
        const issued = await deps.issueCode(me.id);
        return { code: issued.code, mobile: mask(mobile) };
      }

      // It is already mine: just a fresh code.
      if (holder.id === me.id) {
        const issued = await deps.issueCode(me.id);
        return { code: issued.code, mobile: mask(mobile) };
      }

      // It is another person's (often the same human's vendor or customer login). Say whose, and go on only when told to.
      if (input.confirmExisting !== true) {
        const belongsTo = holder.vendorProfile?.vendor.name ? `the login of ${holder.vendorProfile.vendor.name}` : holder.name ? `${holder.name}’s login` : 'an existing login';
        return { confirm: { mobile: mask(mobile), belongsTo } };
      }

      // Link: that person gets MY internal roles and MY place in the Shaadi Shopping business — the same access, never more.
      for (const role of me.internal) {
        await deps.db.userRole.upsert({ where: { userId_role: { userId: holder.id, role } }, create: { userId: holder.id, role }, update: {} });
      }
      const mine = await deps.db.businessMember.findUnique({ where: { businessId_userId: { businessId: PLATFORM_BUSINESS_ID, userId: me.id } }, select: { role: true, jobTitle: true, grants: true, denies: true } });
      if (mine) {
        await deps.db.businessMember.upsert({
          where: { businessId_userId: { businessId: PLATFORM_BUSINESS_ID, userId: holder.id } },
          create: { businessId: PLATFORM_BUSINESS_ID, userId: holder.id, role: mine.role, jobTitle: mine.jobTitle, grants: mine.grants, denies: mine.denies },
          update: { role: mine.role, jobTitle: mine.jobTitle, grants: mine.grants, denies: mine.denies, removedAt: null },
        });
      }
      // Always a NEW code: whatever code that number had before stops working, so only the person at this screen has it.
      const issued = await deps.issueCode(holder.id);
      console.info(`[team-login] internal access (${me.internal.join(', ')}) linked from user ${me.id} to the existing login ${holder.id}`);
      return { code: issued.code, mobile: mask(mobile) };
    },
  };
}

export const teamLoginService = createTeamLoginService();

