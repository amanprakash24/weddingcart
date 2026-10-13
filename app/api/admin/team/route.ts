import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { hasSuperAdmin } from '@/lib/auth/permissions';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { adminTeamService } from '@/services/adminTeam.service';

// GET  /api/admin/team — "Our team": everyone who works at Shaadi Shopping.
// POST /api/admin/team — { name, mobile, role }: add a person. Their 6-digit code is in this one answer only.
//
// The founder (SUPER_ADMIN) only — and the service checks that again against the database (services/adminTeam.service.ts). The
// person acting comes from the session, never from the request.
const noStore = { headers: { 'Cache-Control': 'no-store' } };

async function founderId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id && hasSuperAdmin(session.user.roles) ? session.user.id : null;
}

async function handleGET() {
  const actor = await founderId();
  if (!actor) return NextResponse.json({ success: false, error: 'Only the founder can see the team' }, { status: 403, ...noStore });
  try {
    return NextResponse.json({ success: true, data: await adminTeamService.list(actor) }, noStore);
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePOST(req: NextRequest) {
  const actor = await founderId();
  if (!actor) return NextResponse.json({ success: false, error: 'Only the founder can add to the team' }, { status: 403, ...noStore });
  try {
    const body = (await req.json().catch(() => ({}))) ?? {};
    const result = await adminTeamService.add(actor, body);
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400, ...noStore });
    return NextResponse.json({ success: true, data: result.member, loginCode: result.code }, noStore);
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const POST = platformScoped(handlePOST);
