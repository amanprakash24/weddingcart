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

// General request-volume throttle — same Postgres-backed LoginAttempt table
// and windowed-count pattern as isRateLimited()/recordLoginAttempt() above,
// reused rather than building a second rate-limit mechanism. Unlike
// isRateLimited() (which only counts *failures*, for credential-guessing
// lockout), this counts every recorded call regardless of outcome — for
// callers like a public form POST that have no "wrong guess" concept, where
// the abuse signal is request volume, not repeated bad guesses. Callers
// should namespace their `identifier` (e.g. `consultation:<ip>`) so these
// throttle records stay clearly distinguishable from real login/OTP
// identifiers (email/phone) sharing the same table.
const MAX_REQUESTS_PER_WINDOW = 5;
const REQUEST_WINDOW_MINUTES = 15;

// Fails open (treats the caller as not rate-limited) on a DB error rather
// than throwing — this throttle protects public lead-gen forms from spam,
// it isn't a security boundary like isRateLimited()'s credential lockout
// above, so a transient DB blip here should never take down the whole
// submission (production incident 2026-09-17: a rate-limiter DB error
// crashed /api/consultations with an opaque 500 before the real work — the
// consultation write itself — ever ran).
// `options` lets a caller with a legitimately higher volume (e.g. the
// onboarding form uploads several photos per application) use a bigger budget
// under its own namespaced identifier; every existing caller passes nothing
// and keeps the 5-per-15-minutes default unchanged.
export async function isRequestRateLimited(
  identifier: string,
  options: { max?: number; windowMinutes?: number } = {}
): Promise<boolean> {
  try {
    const max = options.max ?? MAX_REQUESTS_PER_WINDOW;
    const windowMinutes = options.windowMinutes ?? REQUEST_WINDOW_MINUTES;
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const recentRequests = await prisma.loginAttempt.count({
      where: { identifier, createdAt: { gt: since } },
    });
    return recentRequests >= max;
  } catch (err) {
    console.error('isRequestRateLimited: DB error, failing open:', err);
    return false;
  }
}

// Call once a request has passed the isRequestRateLimited() check, before
// doing any real work — this throttles by request volume, not by success, so
// a caller retrying a malformed payload can't dodge the limiter by never
// reaching a "success" recording point. Best-effort: a failure here just
// means this request goes uncounted, which errs toward not blocking real
// submissions over strict throttling accuracy — see isRequestRateLimited()'s
// fail-open reasoning above.
export async function recordRequest(identifier: string): Promise<void> {
  try {
    await prisma.loginAttempt.create({ data: { identifier, success: true } });
  } catch (err) {
    console.error('recordRequest: DB error, request left uncounted:', err);
  }
}
