import { prisma } from '@/lib/prisma';

// Logout-everywhere for stateless JWT sessions.
//
// A NextAuth JWT lives only in the browser, so deleting one browser's cookie (the old logout) left every other
// browser/device logged in for up to 7 days — and a token whose user no longer exists (e.g. issued against the
// deleted production database) kept passing role checks, then failed on the first write ("ActivityLog not found").
//
// Each token now carries the user's `sessionVersion` from login. A token is valid only while the user still exists
// AND their current version equals the token's. Logging out increments the version, so every token for that user —
// on every device — stops working at once. A token without a version (issued before this existed) is invalid.

export async function isSessionCurrent(userId: string | null | undefined, version: number | null | undefined): Promise<boolean> {
  if (!userId || typeof version !== 'number') return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
  return user !== null && user.sessionVersion === version;
}

// updateMany, not update: a missing user (stale token) is a no-op rather than an error, so logout always succeeds.
export async function endAllSessions(userId: string): Promise<void> {
  await prisma.user.updateMany({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
}
