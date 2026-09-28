import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import type { Role } from '@/lib/auth/roles';
import { isSessionCurrent } from '@/lib/auth/sessionVersion';

// App code should call these, not next-auth directly — keeps a future v4->v5
// upgrade (or a provider change) contained to lib/auth/.
// Every protected API route goes through here (directly, or via requireRole / requireAdmin), so this is the one
// place a logged-out-elsewhere or stale token is rejected: the user must still exist and the token's
// sessionVersion must match (lib/auth/sessionVersion.ts). Otherwise the request is treated as logged out.
export async function getSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  if (!(await isSessionCurrent(session.user.id, session.user.sessionVersion))) return null;
  return session;
}

// A session's user can hold multiple roles (Step 4 schema review) — this
// passes if ANY of the user's roles is in `allowed`, not all of them.
export async function requireRole(allowed: Role[]) {
  const session = await getSession();
  if (!session?.user || !session.user.roles.some((role) => allowed.includes(role))) {
    return null;
  }
  return session;
}
