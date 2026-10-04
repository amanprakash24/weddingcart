import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { hasAdminRole, hasSuperAdmin } from '@/lib/auth/permissions';
import { platformScoped } from '@/lib/ownership/entry';

async function handleGET() {
  const session = await getSession();
  if (!session?.user || !hasAdminRole(session.user.roles)) {
    return NextResponse.json({ role: null }, { status: 401 });
  }

  const role = hasSuperAdmin(session.user.roles) ? 'super_admin' : 'admin';
  return NextResponse.json({ role });
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
