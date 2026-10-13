import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { hasSuperAdmin } from '@/lib/auth/permissions';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { adminTeamService } from '@/services/adminTeam.service';

// POST /api/admin/team/[userId]/login-code — { mobile? }: a new 6-digit code for a Sales / Operations person — with a new mobile
// number when one is given (a wrong number, or someone who had none). Their old code stops working and they are signed out
// everywhere. The code is in this one answer only. Never for a founder: a founder's sign-in is theirs alone (My sign-in).
//
// The founder (SUPER_ADMIN) only; the service checks it again (services/adminTeam.service.ts).
const noStore = { headers: { 'Cache-Control': 'no-store' } };

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSession();
  if (!session?.user?.id || !hasSuperAdmin(session.user.roles)) return NextResponse.json({ success: false, error: 'Only the founder can issue a new login code' }, { status: 403, ...noStore });
  try {
    const body = (await req.json().catch(() => ({}))) ?? {};
    const result = await adminTeamService.issueCode(session.user.id, (await params).userId, body.mobile);
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400, ...noStore });
    return NextResponse.json({ success: true, data: result.member, loginCode: result.code }, noStore);
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
