import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { hasAdminRole, hasSuperAdmin } from '@/lib/auth/permissions';

export async function GET() {
  const session = await getSession();
  if (!session?.user || !hasAdminRole(session.user.roles)) {
    return NextResponse.json({ role: null }, { status: 401 });
  }

  const role = hasSuperAdmin(session.user.roles) ? 'super_admin' : 'admin';
  return NextResponse.json({ role });
}
