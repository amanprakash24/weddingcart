import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import type { Role } from '@/lib/auth/roles';

// App code should call these, not next-auth directly — keeps a future v4->v5
// upgrade (or a provider change) contained to lib/auth/.
export async function getSession() {
  return getServerSession(authOptions);
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
