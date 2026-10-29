import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { hasSuperAdmin } from '@/lib/auth/permissions';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { coupleLookupService } from '@/services/coupleLogin.service';

// GET  /api/admin/couple-logins?mobile=… — the founder finds a couple's My Wedding sign-in by mobile: name, whether it has a code,
//      and which weddings it shows (any business's).
// POST /api/admin/couple-logins — { mobile }: a new 6-digit code for that couple (a forgotten code). The old one stops working and
//      they are signed out everywhere; the code is in this answer only.
// SUPER_ADMIN only, both: a new code is a way to sign in as the couple. services/coupleLogin.service.ts has the rules.
const noStore = { 'Cache-Control': 'no-store' };

async function founder() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (!hasSuperAdmin(session.user.roles ?? [])) return NextResponse.json({ success: false, error: 'Only the founder can look up or replace a couple’s code' }, { status: 403 });
  return null;
}

async function handleGET(req: NextRequest) {
  const refused = await founder();
  if (refused) return refused;
  try {
    return NextResponse.json({ success: true, data: await coupleLookupService.find(req.nextUrl.searchParams.get('mobile')) }, { headers: noStore });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePOST(req: NextRequest) {
  const refused = await founder();
  if (refused) return refused;
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ success: true, data: await coupleLookupService.replace(body?.mobile) }, { headers: noStore });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const POST = platformScoped(handlePOST);
