import { getSession } from '@/lib/auth/session';
import { hasAdminRole } from '@/lib/auth/permissions';

// Milestone 4 (Authentication Transition): the legacy HMAC admin_session
// cookie is gone (see middleware.ts, app/api/admin/*). This is now a thin
// shim over the NextAuth session so the ~20 API routes that already call
// requireAdmin() don't each need to change — only this implementation does.
export async function requireAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session?.user) return false;
  return hasAdminRole(session.user.roles);
}
