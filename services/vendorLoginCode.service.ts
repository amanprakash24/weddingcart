import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { isRateLimited, recordLoginAttempt } from '@/lib/auth/rateLimit';
import type { Role } from '@/lib/auth/roles';
import { codeNeedsReminder, generateLoginCode, isWellFormedCode, normalizeMobile, validateCodeChange, type NewCodeErrors } from '@/lib/auth/vendorCode';

// The login code (built 6 Oct 2026 for vendor owners; since 7 Oct 2026 for EVERY person). A person signs in with their own mobile
// number + their own 6-digit code — founder, manager, employee or vendor owner, the same mechanism for all. The code belongs to
// the PERSON (User), not to a vendor; what they may do after signing in comes from their memberships (services/venueBusiness
// .service.ts). Only a bcrypt hash is stored — the code exists in the clear exactly once, in the answer to whoever issued it.
//
// A 6-digit code has a million possibilities, so every place that checks one is locked after 5 wrong tries in 15 minutes
// (lib/auth/rateLimit.ts), under its own namespaced identifier.
//
// (The file and export names still say "vendor": they are imported widely, and renaming them is not worth a second auth module.)

const HASH_ROUNDS = 10;
export const hashLoginCode = (code: string) => bcrypt.hash(code, HASH_ROUNDS);
// A fresh code from the operating system's random source — never Math.random.
export const newLoginCode = () => generateLoginCode(randomInt);

// What a session needs — the same shape the OTP sign-in returns (lib/auth/auth.ts). vendorId: the vendor this person owns through
// the older owner link, if any (kept for the parts of the app that still read it from the session).
export interface VendorLogin {
  id: string;
  name: string | null;
  roles: Role[];
  vendorId?: string;
  sessionVersion: number;
}

export interface VendorLoginCodeDeps {
  db: {
    user: Pick<typeof prisma.user, 'findUnique' | 'update'>;
    vendorProfile: Pick<typeof prisma.vendorProfile, 'findUnique'>;
  };
  isLocked: typeof isRateLimited;
  record: typeof recordLoginAttempt;
  hash: (code: string) => Promise<string>;
  compare: (code: string, hash: string) => Promise<boolean>;
  newCode: () => string;
  now: () => Date;
}

const defaultDeps = (): VendorLoginCodeDeps => ({
  db: prisma,
  isLocked: isRateLimited,
  record: recordLoginAttempt,
  hash: hashLoginCode,
  compare: (code, hash) => bcrypt.compare(code, hash),
  newCode: newLoginCode,
  now: () => new Date(),
});

export function createVendorLoginCodeService(deps: VendorLoginCodeDeps = defaultDeps()) {
  // A new code for one person. The old one stops working and every device signed in as them is signed out.
  async function issueForUser(userId: string): Promise<{ code: string; mobile: string | null }> {
    const user = await deps.db.user.findUnique({ where: { id: userId }, select: { id: true, phone: true } });
    if (!user) throw new NotFoundError('Login', userId);
    // No mobile number, no code login: the code is only ever half of "mobile number + code".
    if (!user.phone) throw new ConflictError('This person has no mobile number yet — add it first');
    const code = deps.newCode();
    await deps.db.user.update({ where: { id: userId }, data: { loginCodeHash: await deps.hash(code), loginCodeSetAt: deps.now(), sessionVersion: { increment: 1 } } });
    return { code, mobile: user.phone };
  }

  return {
    // Sign-in: the registered mobile number + the code. null for every kind of "no" — an unknown number, a person with no code
    // yet, a wrong code, a locked number — so the answer never says which.
    async verify(phoneInput: unknown, code: unknown): Promise<VendorLogin | null> {
      const phone = normalizeMobile(phoneInput);
      if (!phone || !isWellFormedCode(code)) return null;
      // The identifier keeps its first name ("vendor-code:") so a lock already counting for a number carries on.
      const identifier = `vendor-code:${phone}`;
      if (await deps.isLocked(identifier)) return null;

      const user = await deps.db.user.findUnique({ where: { phone }, include: { roles: true, vendorProfile: true } });
      const hash = user?.loginCodeHash;
      const ok = !!user && !!hash && (await deps.compare(code, hash));
      await deps.record(identifier, ok);
      if (!ok || !user) return null;
      return { id: user.id, name: user.name, roles: user.roles.map((r) => r.role), vendorId: user.vendorProfile?.vendorId ?? undefined, sessionVersion: user.sessionVersion };
    },

    issueForUser,

    // An admin issues a new code for a vendor's owner (a lost code, or a vendor from before codes existed). Returns the code —
    // the only time it is ever readable.
    async issue(vendorId: string): Promise<{ code: string; mobile: string | null }> {
      const profile = await deps.db.vendorProfile.findUnique({ where: { vendorId }, select: { userId: true } });
      if (!profile) throw new NotFoundError('Vendor login', vendorId);
      return issueForUser(profile.userId);
    },

    // A person changes their own code: the current one, and the new one twice. They stay signed in on this device.
    async change(userId: string, input: { current?: unknown; next?: unknown; confirm?: unknown }): Promise<{ changed: true } | { errors: NewCodeErrors }> {
      const errors = validateCodeChange(input);
      if (errors) return { errors };
      const identifier = `vendor-code-change:${userId}`;
      if (await deps.isLocked(identifier)) throw new ConflictError('Too many wrong tries — please wait 15 minutes and try again');

      const user = await deps.db.user.findUnique({ where: { id: userId }, select: { id: true, loginCodeHash: true } });
      if (!user) throw new NotFoundError('Login', userId);
      const ok = !!user.loginCodeHash && (await deps.compare(input.current as string, user.loginCodeHash));
      await deps.record(identifier, ok);
      if (!ok) return { errors: { current: 'That is not your current code' } };

      await deps.db.user.update({ where: { id: user.id }, data: { loginCodeHash: await deps.hash(input.next as string), loginCodeSetAt: deps.now() } });
      return { changed: true };
    },

    // For the dashboard: does this person have a code, and is it time to remind them to change it?
    async status(userId: string): Promise<{ hasCode: boolean; setAt: Date | null; reminder: boolean }> {
      const user = await deps.db.user.findUnique({ where: { id: userId }, select: { loginCodeHash: true, loginCodeSetAt: true } });
      const hasCode = !!user?.loginCodeHash;
      return { hasCode, setAt: hasCode ? (user?.loginCodeSetAt ?? null) : null, reminder: hasCode && codeNeedsReminder(user?.loginCodeSetAt, deps.now()) };
    },
  };
}

export const vendorLoginCodeService = createVendorLoginCodeService();
