import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import type { Role } from '@/lib/auth/roles';

// App code should call these, not next-auth directly — keeps a future v4->v5
// upgrade (or a provider change) contained to lib/auth/.
export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireRole(allowed: Role[]) {
  const session = await getSession();
  if (!session?.user || !allowed.includes(session.user.role)) {
    return null;
  }
  return session;
}
