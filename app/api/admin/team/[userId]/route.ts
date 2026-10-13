import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { hasSuperAdmin } from '@/lib/auth/permissions';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { adminTeamService } from '@/services/adminTeam.service';

// PUT    /api/admin/team/[userId] — { name } and/or { role }: name a person on the team (anyone, the founder included), or move a
//                                    Sales / Operations person to the other role.
// DELETE /api/admin/team/[userId] — take them out of the team. Never a founder, never yourself.
//
// The founder (SUPER_ADMIN) only; the service checks it again (services/adminTeam.service.ts).
const noStore = { headers: { 'Cache-Control': 'no-store' } };
type Ctx = { params: Promise<{ userId: string }> };

async function founderId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id && hasSuperAdmin(session.user.roles) ? session.user.id : null;
}

async function handlePUT(req: NextRequest, { params }: Ctx) {
  const actor = await founderId();
  if (!actor) return NextResponse.json({ success: false, error: 'Only the founder can change the team' }, { status: 403, ...noStore });
  try {
    const { userId } = await params;
    const body = (await req.json().catch(() => ({}))) ?? {};
    let member = null;
    for (const step of [
      body.name !== undefined ? () => adminTeamService.rename(actor, userId, body.name) : null,
      body.role !== undefined ? () => adminTeamService.setRole(actor, userId, body.role) : null,
    ]) {
      if (!step) continue;
      const result = await step();
      if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400, ...noStore });
      member = result;
    }
    if (!member) return NextResponse.json({ success: false, error: 'Nothing to change' }, { status: 400, ...noStore });
    return NextResponse.json({ success: true, data: member }, noStore);
  } catch (err) {
    return handleApiError(err);
  }
}

async function handleDELETE(_req: NextRequest, { params }: Ctx) {
  const actor = await founderId();
  if (!actor) return NextResponse.json({ success: false, error: 'Only the founder can change the team' }, { status: 403, ...noStore });
  try {
    return NextResponse.json({ success: true, data: await adminTeamService.remove(actor, (await params).userId) }, noStore);
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const PUT = platformScoped(handlePUT);
export const DELETE = platformScoped(handleDELETE);
