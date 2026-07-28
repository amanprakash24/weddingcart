import type { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { Role, ADMIN_ROLES } from '@/lib/auth/roles';
import { isRateLimited, recordLoginAttempt } from '@/lib/auth/rateLimit';

// Auth.js v4 (stable/GA), not v5 — see docs/postgres-migration-plan.md for why
// v5 (beta-only as of this migration) was rejected for production auth.
// JWT session strategy, Credentials-only (no OAuth), so no Prisma adapter is
// wired here — sessions never touch the DB after login.
// Security checklist item #1 (docs/security-checklist.md): explicit maxAge,
// not NextAuth's 30-day default. Matches the legacy admin_session cookie's
// 7-day expiry (lib/adminAuth.ts) rather than inventing a new value.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const authOptions: AuthOptions = {
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },
  pages: {
    signIn: '/admin/login',
  },
  providers: [
    // Super Admin / Sales — email + password, replaces the env-var HMAC login
    // in lib/adminAuth.ts.
    CredentialsProvider({
      id: 'credentials',
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        // Checked before touching the password — a locked-out identifier is
        // rejected without confirming/denying whether the password itself
        // would have been correct.
        if (await isRateLimited(credentials.email)) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { roles: true },
        });
        if (!user || !user.passwordHash) {
          await recordLoginAttempt(credentials.email, false);
          return null;
        }
        const roles = user.roles.map((r) => r.role);
        if (!roles.some((role) => ADMIN_ROLES.includes(role))) {
          await recordLoginAttempt(credentials.email, false);
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        await recordLoginAttempt(credentials.email, valid);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, roles };
      },
    }),
    // Vendor / Customer — phone + OTP. Structurally complete against the
    // Postgres `Otp` table, but NOT independently testable yet: /api/otp/send
    // and /api/otp/verify still write to MongoDB today (not migrated — see
    // the Milestone 4 module list in docs/postgres-migration-plan.md, which
    // does not currently name OTP explicitly). This provider will only work
    // once OTP send/verify is repointed at Prisma.
    CredentialsProvider({
      id: 'otp',
      name: 'Phone and OTP',
      credentials: {
        phone: { label: 'Phone', type: 'text' },
        code: { label: 'Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials.code) return null;

        // Same rate limiting as the credentials provider, keyed on phone —
        // without this, a 6-digit OTP code is brute-forceable (only 1M
        // combinations, no limit otherwise on verify attempts).
        if (await isRateLimited(credentials.phone)) return null;

        const otp = await prisma.otp.findFirst({
          where: { phone: credentials.phone, code: credentials.code, expiresAt: { gt: new Date() } },
        });
        if (!otp) {
          await recordLoginAttempt(credentials.phone, false);
          return null;
        }

        await prisma.otp.delete({ where: { id: otp.id } });
        await recordLoginAttempt(credentials.phone, true);

        let user = await prisma.user.findUnique({
          where: { phone: credentials.phone },
          include: { roles: true, vendorProfile: true },
        });
        if (!user) {
          // First-time phone login defaults to CUSTOMER. VENDOR accounts are
          // provisioned deliberately (on VendorApplication approval, linked
          // via VendorProfile) rather than auto-created here — a phone with
          // no existing account is assumed to be a customer, not a vendor.
          // Flagged for product sign-off, not a unilateral final decision.
          // A CUSTOMER role here doesn't preclude this same User later also
          // gaining a VENDOR role (see lib/auth/roles.ts — multi-role per
          // phone number, resolved in the Step 4 schema review) — this just
          // sets up their first role, not their only possible one.
          user = await prisma.user.create({
            data: { phone: credentials.phone, roles: { create: { role: Role.CUSTOMER } } },
            include: { roles: true, vendorProfile: true },
          });
        }

        return {
          id: user.id,
          name: user.name,
          roles: user.roles.map((r) => r.role),
          vendorId: user.vendorProfile?.vendorId ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.roles = user.roles;
        token.vendorId = user.vendorId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.roles = token.roles;
        session.user.vendorId = token.vendorId;
      }
      return session;
    },
  },
};
