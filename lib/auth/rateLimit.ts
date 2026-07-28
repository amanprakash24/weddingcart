import { prisma } from '@/lib/prisma';

// Security checklist item #2 — see prisma/schema.prisma's LoginAttempt model
// comment for why this is Postgres-backed rather than in-memory (Vercel is
// serverless/multi-instance).
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

// Call BEFORE checking credentials. Returns true if this identifier is
// currently locked out (too many recent failures) — callers should reject
// the login attempt without even checking the password/OTP in that case, so
// a locked-out account doesn't leak whether the password would've been correct.
export async function isRateLimited(identifier: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const recentFailures = await prisma.loginAttempt.count({
    where: { identifier, success: false, createdAt: { gt: since } },
  });
  return recentFailures >= MAX_FAILED_ATTEMPTS;
}

// Call AFTER checking credentials, regardless of outcome — both successes
// and failures get recorded (a success should also reset the effective
// count, which querying only recent rows naturally handles without needing
// a separate reset step).
export async function recordLoginAttempt(identifier: string, success: boolean): Promise<void> {
  await prisma.loginAttempt.create({ data: { identifier, success } });
}
