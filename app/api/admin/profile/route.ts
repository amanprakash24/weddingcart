import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { hasAdminRole } from '@/lib/auth/permissions';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { adminProfileService } from '@/services/adminProfile.service';

// GET /api/admin/profile — my own profile: name, designation, photo, role, how I sign in.
// PUT /api/admin/profile — { name?, designation?, photoUrl? }: change my own. photoUrl is one of our uploads (/api/upload) or null.
//
// For a signed-in member of Shaadi Shopping's own team, about THEMSELVES only — the person comes from the session, never from
// the request (services/adminProfile.service.ts).
const noStore = { headers: { 'Cache-Control': 'no-store' } };

async function me(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id && hasAdminRole(session.user.roles) ? session.user.id : null;
}

async function handleGET() {
  const userId = await me();
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, ...noStore });
  try {
    return NextResponse.json({ success: true, data: await adminProfileService.get(userId) }, noStore);
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePUT(req: NextRequest) {
  const userId = await me();
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, ...noStore });
  try {
    const body = (await req.json().catch(() => ({}))) ?? {};
    const result = await adminProfileService.update(userId, body);
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400, ...noStore });
    return NextResponse.json({ success: true, data: result }, noStore);
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const PUT = platformScoped(handlePUT);
