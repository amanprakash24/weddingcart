import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { hasAdminRole } from '@/lib/auth/permissions';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { teamLoginService } from '@/services/teamLogin.service';

// GET  /api/admin/account/sign-in — my own sign-in: the mobile number on it (masked), whether I have a code and a password.
// POST /api/admin/account/sign-in — { mobile, password, confirmExisting? }: register MY mobile number and get MY 6-digit code.
//
// For a signed-in member of Shaadi Shopping's own team, about THEMSELVES only — the person comes from the session, never from
// the request. The code is in the one answer that issues it and is never readable again. services/teamLogin.service.ts has the
// safety rules (the password again, the lock, the confirmation when a number already belongs to another login).
const noStore = { headers: { 'Cache-Control': 'no-store' } };

async function me(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id && hasAdminRole(session.user.roles) ? session.user.id : null;
}

async function handleGET() {
  const userId = await me();
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, ...noStore });
  try {
    return NextResponse.json({ success: true, data: await teamLoginService.status(userId) }, noStore);
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePOST(req: NextRequest) {
  const userId = await me();
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, ...noStore });
  try {
    const body = await req.json().catch(() => ({}));
    const result = await teamLoginService.linkMobile(userId, { mobile: body?.mobile, password: body?.password, confirmExisting: body?.confirmExisting === true });
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400, ...noStore });
    if ('confirm' in result) return NextResponse.json({ success: false, confirm: result.confirm }, { status: 409, ...noStore });
    return NextResponse.json({ success: true, loginCode: result.code, mobile: result.mobile }, noStore);
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const POST = platformScoped(handlePOST);
