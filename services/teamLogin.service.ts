import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { isRateLimited, recordLoginAttempt } from '@/lib/auth/rateLimit';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { isWellFormedCode, normalizeMobile } from '@/lib/auth/vendorCode';
import { PLATFORM_BUSINESS_ID } from '@/lib/ownership/owned';
import { vendorLoginCodeService } from '@/services/vendorLoginCode.service';

// "My sign-in" for Shaadi Shopping's own team (7 Oct 2026): a team member — the founder first — registers THEIR OWN mobile number
// and gets their own 6-digit code, so they can sign in the way everyone does (mobile number + code). The number is typed on a
// screen, by the person, while they are signed in; it is never written in the source code. Email + password keeps working.
//
// THE RULE THIS FILE EXISTS TO KEEP: nobody's login code is ever replaced, and nobody's login is ever given more access, without
// proof from the person it belongs to.
//   - Only a signed-in member of the internal team, and only for THEMSELVES.
//   - They prove it is them again: their password, or — for a login that has no password — their own current code.
//   - A number NOBODY has: it becomes theirs, and they get a new code (there was no code to replace).
//   - A number that is ALREADY SOMEONE'S LOGIN (often the same human's vendor login): it is linked only if they also enter THAT
//     login's current code — proof that they hold it. Its code is NOT changed and no code is shown. Without that code, nothing
//     happens: a team member cannot attach themselves to, or take over, a number they merely know.
//   - A login with no code cannot be linked here at all (there is nothing to prove with).
//   - Every wrong try — password or code — counts against the same 5-in-15-minutes lock.
//
// What "linking" means: the person with that mobile number is given the same internal roles and the same membership of the Shaadi
// Shopping business as the team member — the same access, never more. One person, several memberships.

const mask = (mobile: string) => `${mobile.slice(0, 2)}******${mobile.slice(-2)}`;

export interface TeamLoginDeps {
  db: Pick<typeof prisma, 'user' | 'userRole' | 'businessMember'>;
  isLocked: typeof isRateLimited;
  record: typeof recordLoginAttempt;
  compare: (secret: string, hash: string) => Promise<boolean>; // bcrypt — passwords and codes alike
  issueCode: (userId: string) => Promise<{ code: string; mobile: string | null }>;
}

const defaultDeps = (): TeamLoginDeps => ({
  db: prisma,
  isLocked: isRateLimited,
  record: recordLoginAttempt,
  compare: (secret, hash) => bcrypt.compare(secret, hash),
  issueCode: (userId) => vendorLoginCodeService.issueForUser(userId),
});

export type LinkErrors = Partial<Record<'mobile' | 'password' | 'myCode' | 'theirCode', string>>;

export type LinkResult =
  | { code: string; mobile: string } // a new number, or my own again — my code, shown once
  | { linked: true; mobile: string } // an existing login, proven mine — its code is unchanged and not shown
  | { needsTheirCode: { mobile: string; belongsTo: string } } // that number is already a login: prove it is yours
  | { errors: LinkErrors };

export function createTeamLoginService(deps: TeamLoginDeps = defaultDeps()) {
  async function teamMember(userId: string) {
    const me = await deps.db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, phone: true, passwordHash: true, loginCodeHash: true, roles: { select: { role: true } } } });
    if (!me) throw new NotFoundError('Login', userId);
    const internal = me.roles.map((r) => r.role).filter((r) => ADMIN_ROLES.includes(r));
    if (internal.length === 0) throw new NotFoundError('Login', userId); // not the internal team — nothing here is for them
    return { ...me, internal };
  }

  return {
    // What the "My sign-in" card shows. The number is masked — the screen never needs the whole of it.
    async status(userId: string): Promise<{ mobile: string | null; hasCode: boolean; hasPassword: boolean }> {
      const me = await teamMember(userId);
      return { mobile: me.phone ? mask(me.phone) : null, hasCode: me.loginCodeHash !== null, hasPassword: me.passwordHash !== null };
    },

    // Register (or change) my mobile number.
    //   password  — my current password (asked when I have one)
    //   myCode    — my own current login code (asked when I have no password)
    //   theirCode — the current code of the login that already holds that number (asked only then)
    async linkMobile(userId: string, input: { mobile?: unknown; password?: unknown; myCode?: unknown; theirCode?: unknown }): Promise<LinkResult> {
      const me = await teamMember(userId);
      const mobile = normalizeMobile(input.mobile);
      if (!mobile) return { errors: { mobile: 'Enter your 10-digit mobile number' } };

      const lock = `team-login-link:${userId}`;
      if (await deps.isLocked(lock)) throw new ConflictError('Too many wrong tries — please wait 15 minutes and try again');

      // 1. It is really me, again. A login with neither a password nor a code cannot prove that, so it cannot use this screen.
      if (me.passwordHash) {
        const ok = typeof input.password === 'string' && input.password.length > 0 && (await deps.compare(input.password, me.passwordHash));
        await deps.record(lock, ok);
        if (!ok) return { errors: { password: 'That is not your current password' } };
      } else if (me.loginCodeHash) {
        const ok = isWellFormedCode(input.myCode) && (await deps.compare(input.myCode, me.loginCodeHash));
        await deps.record(lock, ok);
        if (!ok) return { errors: { myCode: 'That is not your current login code' } };
      } else {
        throw new ConflictError('This login has no password or code to confirm it is you');
      }

      const holder = await deps.db.user.findUnique({ where: { phone: mobile }, select: { id: true, name: true, loginCodeHash: true, vendorProfile: { select: { vendor: { select: { name: true } } } } } });

      // 2a. Nobody has this number: it becomes mine, on my own account, with a new code. (No code existed to be replaced.)
      if (!holder) {
        await deps.db.user.update({ where: { id: me.id }, data: { phone: mobile } });
        const issued = await deps.issueCode(me.id);
        return { code: issued.code, mobile: mask(mobile) };
      }

      // 2b. It is already mine: a fresh code for myself — I have just proved who I am.
      if (holder.id === me.id) {
        const issued = await deps.issueCode(me.id);
        return { code: issued.code, mobile: mask(mobile) };
      }

      // 2c. It is ALREADY ANOTHER LOGIN. Knowing a number proves nothing — only that login's own current code does.
      const belongsTo = holder.vendorProfile?.vendor.name ? `the login of ${holder.vendorProfile.vendor.name}` : holder.name ? `${holder.name}’s login` : 'an existing login';
      if (!holder.loginCodeHash) {
        throw new ConflictError(`${mask(mobile)} is already ${belongsTo}, and it has no login code to confirm it is yours. It cannot be linked here.`);
      }
      if (input.theirCode === undefined || input.theirCode === null || input.theirCode === '') return { needsTheirCode: { mobile: mask(mobile), belongsTo } };
      const proven = isWellFormedCode(input.theirCode) && (await deps.compare(input.theirCode, holder.loginCodeHash));
      await deps.record(lock, proven);
      if (!proven) return { errors: { theirCode: 'That is not the current code of that login' } };

      // Proven. That person gets MY internal roles and MY place in the Shaadi Shopping business — the same access, never more.
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
      // Its code is untouched: the person who holds that login keeps signing in exactly as before.
      console.info(`[team-login] internal access (${me.internal.join(', ')}) linked from user ${me.id} to the existing login ${holder.id}, proven with that login's code`);
      return { linked: true, mobile: mask(mobile) };
    },
  };
}

export const teamLoginService = createTeamLoginService();
