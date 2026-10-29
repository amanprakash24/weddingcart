import type { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { isRateLimited, recordLoginAttempt } from '@/lib/auth/rateLimit';
import { vendorLoginCodeService } from '@/services/vendorLoginCode.service';

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

        return { id: user.id, email: user.email, name: user.name, roles, sessionVersion: user.sessionVersion };
      },
    }),
    // Every person — founder, manager, employee, vendor owner — signs in the same way (7 Oct 2026): their own mobile number + their
    // own 6-digit login code. All the checking — the 5-wrong-tries lock, the hash compare, "no code yet" — is in the service; null
    // is the one answer for every kind of "no". What they may do afterwards comes from their memberships, not from this.
    ...(['code', 'vendor-code'] as const).map((id) =>
      CredentialsProvider({
        id, // 'vendor-code' is the first name of the same thing — kept so a sign-in page already open during a deploy still works
        name: 'Mobile number and login code',
        credentials: {
          phone: { label: 'Mobile number', type: 'text' },
          code: { label: 'Login code', type: 'password' },
        },
        async authorize(credentials) {
          return vendorLoginCodeService.verify(credentials?.phone, credentials?.code);
        },
      })
    ),
    // The WhatsApp one-time-code sign-in ('otp') was removed on 28 Oct 2026: couples now sign in like everyone else, with their mobile
    // number + their own 6-digit login code (services/coupleLogin.service.ts).
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.roles = user.roles;
        token.vendorId = user.vendorId;
        token.sv = user.sessionVersion; // checked on every request — see lib/auth/sessionVersion.ts
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // The user's id (the JWT subject). Without it every `session.user.id ?? null` in the app was null, so nothing done by a person —
        // a note, a stage change, a payment — could record who did it.
        session.user.id = token.sub ?? undefined;
        session.user.roles = token.roles;
        session.user.vendorId = token.vendorId;
        session.user.sessionVersion = token.sv;
      }
      return session;
    },
  },
};
