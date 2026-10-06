import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { isRateLimited, recordLoginAttempt } from '@/lib/auth/rateLimit';
import type { Role } from '@/lib/auth/roles';
import { codeNeedsReminder, generateLoginCode, isWellFormedCode, normalizeMobile, validateCodeChange, type NewCodeErrors } from '@/lib/auth/vendorCode';

// The vendor login code (6 Oct 2026). Shaadi Shopping issues a 6-digit code when it accepts a registration; the vendor signs in
// with the registered mobile number + the code, and may change it. Only a bcrypt hash is stored — the code itself exists in the
// clear exactly once, in the answer to the admin who issued it.
//
// A 6-digit code has a million possibilities, so every place that checks one is locked after 5 wrong tries in 15 minutes
// (lib/auth/rateLimit.ts), under its own namespaced identifier.

const HASH_ROUNDS = 10;
export const hashLoginCode = (code: string) => bcrypt.hash(code, HASH_ROUNDS);
// A fresh code from the operating system's random source — never Math.random.
export const newLoginCode = () => generateLoginCode(randomInt);

// What a session needs — the same shape the OTP sign-in returns (lib/auth/auth.ts).
export interface VendorLogin {
  id: string;
  name: string | null;
  roles: Role[];
  vendorId: string;
  sessionVersion: number;
}

export interface VendorLoginCodeDeps {
  db: {
    user: Pick<typeof prisma.user, 'findUnique' | 'update'>;
    vendorProfile: Pick<typeof prisma.vendorProfile, 'findUnique' | 'update'>;
    $transaction: typeof prisma.$transaction;
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
  return {
    // Sign-in: the registered mobile number + the code. null for every kind of "no" — an unknown number, a login with no code yet,
    // a wrong code, a locked number — so the answer never says which.
    async verify(phoneInput: unknown, code: unknown): Promise<VendorLogin | null> {
      const phone = normalizeMobile(phoneInput);
      if (!phone || !isWellFormedCode(code)) return null;
      const identifier = `vendor-code:${phone}`;
      if (await deps.isLocked(identifier)) return null;

      const user = await deps.db.user.findUnique({ where: { phone }, include: { roles: true, vendorProfile: true } });
      const hash = user?.vendorProfile?.loginCodeHash;
      const ok = !!user && !!hash && (await deps.compare(code, hash));
      await deps.record(identifier, ok);
      if (!ok || !user?.vendorProfile) return null;
      return { id: user.id, name: user.name, roles: user.roles.map((r) => r.role), vendorId: user.vendorProfile.vendorId, sessionVersion: user.sessionVersion };
    },

    // An admin issues a new code for a vendor that already has a login (a lost code, or a vendor from before codes existed).
    // The old code stops working and every device signed in as this vendor is signed out. Returns the code — the only time it is
    // ever readable.
    async issue(vendorId: string): Promise<{ code: string; mobile: string | null }> {
      const profile = await deps.db.vendorProfile.findUnique({ where: { vendorId }, select: { id: true, userId: true, user: { select: { phone: true } } } });
      if (!profile) throw new NotFoundError('Vendor login', vendorId);
      const code = deps.newCode();
      const loginCodeHash = await deps.hash(code);
      await deps.db.$transaction([
        deps.db.vendorProfile.update({ where: { id: profile.id }, data: { loginCodeHash, loginCodeSetAt: deps.now() } }),
        deps.db.user.update({ where: { id: profile.userId }, data: { sessionVersion: { increment: 1 } } }),
      ]);
      return { code, mobile: profile.user.phone };
    },

    // The vendor changes their own code: the current one, and the new one twice. They stay signed in on this device.
    async change(userId: string, input: { current?: unknown; next?: unknown; confirm?: unknown }): Promise<{ changed: true } | { errors: NewCodeErrors }> {
      const errors = validateCodeChange(input);
      if (errors) return { errors };
      const identifier = `vendor-code-change:${userId}`;
      if (await deps.isLocked(identifier)) throw new ConflictError('Too many wrong tries — please wait 15 minutes and try again');

      const profile = await deps.db.vendorProfile.findUnique({ where: { userId }, select: { id: true, loginCodeHash: true } });
      if (!profile) throw new NotFoundError('Vendor login', userId);
      const ok = !!profile.loginCodeHash && (await deps.compare(input.current as string, profile.loginCodeHash));
      await deps.record(identifier, ok);
      if (!ok) return { errors: { current: 'That is not your current code' } };

      await deps.db.vendorProfile.update({ where: { id: profile.id }, data: { loginCodeHash: await deps.hash(input.next as string), loginCodeSetAt: deps.now() } });
      return { changed: true };
    },

    // For the dashboard: does this login have a code, and is it time to remind them to change it?
    async status(userId: string): Promise<{ hasCode: boolean; setAt: Date | null; reminder: boolean }> {
      const profile = await deps.db.vendorProfile.findUnique({ where: { userId }, select: { loginCodeHash: true, loginCodeSetAt: true } });
      const hasCode = !!profile?.loginCodeHash;
      return { hasCode, setAt: hasCode ? (profile?.loginCodeSetAt ?? null) : null, reminder: hasCode && codeNeedsReminder(profile?.loginCodeSetAt, deps.now()) };
    },
  };
}

export const vendorLoginCodeService = createVendorLoginCodeService();
