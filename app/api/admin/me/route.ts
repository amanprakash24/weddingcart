import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { hasAdminRole, hasSuperAdmin } from '@/lib/auth/permissions';
import { platformScoped } from '@/lib/ownership/entry';
import { adminProfileService } from '@/services/adminProfile.service';

async function handleGET() {
  const session = await getSession();
  if (!session?.user || !hasAdminRole(session.user.roles)) {
    return NextResponse.json({ role: null }, { status: 401 });
  }

  const role = hasSuperAdmin(session.user.roles) ? 'super_admin' : 'admin';
  // Who is signed in, for the menu: name, designation and photo (My profile). The menu still works if this cannot be read.
  const me = await adminProfileService.get(session.user.id ?? '').then((p) => ({ name: p.name, designation: p.designation, photoUrl: p.photoUrl }), () => null);
  return NextResponse.json({ role, me }, { headers: { 'Cache-Control': 'no-store' } });
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
