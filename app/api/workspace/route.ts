import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { chosenWorkspace, WORKSPACE_COOKIE, workspaceCookieOptions, workspaceHome } from '@/lib/auth/workspace';
import { venueBusinessService } from '@/services/venueBusiness.service';

// GET  /api/workspace — the businesses the signed-in person is a member of ("Choose Workspace"), and the one chosen now.
// POST /api/workspace — { businessId }: choose one. It must be one of their memberships; the answer says where it opens.
//
// About the signed-in person's own memberships only — the user comes from the session, never from the request. Memberships are
// not owned records, so this route is on the short exempt list in lib/ownership/entry.test.ts rather than behind a scope wrapper.
const noStore = { headers: { 'Cache-Control': 'no-store' } };
const signedOut = () => NextResponse.json({ success: false, error: 'Please sign in' }, { status: 401, ...noStore });

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) return signedOut();
  try {
    const workspaces = await venueBusinessService.workspaces(session.user.id);
    const chosen = await chosenWorkspace();
    return NextResponse.json(
      {
        success: true,
        data: {
          // Only what the chooser shows — no permission lists leave the server here.
          workspaces: workspaces.map((w) => ({ businessId: w.businessId, name: w.name, kind: w.kind, role: w.role, jobTitle: w.jobTitle, home: workspaceHome(w.kind) })),
          current: workspaces.some((w) => w.businessId === chosen) ? chosen : null,
        },
      },
      noStore
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) return signedOut();
  try {
    const body = await req.json().catch(() => ({}));
    const picked = (await venueBusinessService.workspaces(session.user.id)).find((w) => w.businessId === body?.businessId);
    // Not one of their memberships: the same answer whether the business exists or not.
    if (!picked) return NextResponse.json({ success: false, error: 'That workspace is not available to you' }, { status: 403, ...noStore });
    const res = NextResponse.json({ success: true, data: { businessId: picked.businessId, home: workspaceHome(picked.kind) } }, noStore);
    res.cookies.set(WORKSPACE_COOKIE, picked.businessId, workspaceCookieOptions);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
