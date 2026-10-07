import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { chosenWorkspace, WORKSPACE_COOKIE, workspaceCookieOptions, workspaceHome } from '@/lib/auth/workspace';
import { venueBusinessService, type Workspace } from '@/services/venueBusiness.service';

// GET  /api/workspace — the businesses the signed-in person is a member of ("Choose Workspace"), and the one chosen now.
// POST /api/workspace — { businessId }: choose one. It must be one of their memberships; the answer says where it opens.
//
// About the signed-in person's own memberships only — the user comes from the session, never from the request. Memberships are
// not owned records, so this route is on the short exempt list in lib/ownership/entry.test.ts rather than behind a scope wrapper.
const noStore = { headers: { 'Cache-Control': 'no-store' } };
// Is this workspace the vendor this person OWNS through the older owner link? Only there do the screens read through that link
// (Today, Payments …) show the right business.
const viewOf = (w: Workspace, ownVendorId: string | null | undefined) => ({ permissions: w.permissions, ownsVendor: w.vendorId !== null && w.vendorId === (ownVendorId ?? null) });

const signedOut = () => NextResponse.json({ success: false, error: 'Please sign in' }, { status: 401, ...noStore });

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) return signedOut();
  try {
    const workspaces = await venueBusinessService.workspaces(session.user.id);
    const chosen = await chosenWorkspace();
    const own = session.user.vendorId;
    // The vendor business this person is working in now — the same rule the routes use (venueBusinessService
    // .scopeForVendorLogin): the one they chose, or their only one.
    const vendorSide = workspaces.filter((w) => w.kind === 'VENDOR');
    const working = vendorSide.find((w) => w.businessId === chosen) ?? (vendorSide.length === 1 ? vendorSide[0] : undefined);
    return NextResponse.json(
      {
        success: true,
        data: {
          workspaces: workspaces.map((w) => ({ businessId: w.businessId, name: w.name, kind: w.kind, role: w.role, jobTitle: w.jobTitle, home: workspaceHome(w.kind, viewOf(w, own)) })),
          current: workspaces.some((w) => w.businessId === chosen) ? chosen : null,
          // For the Vendor OS menu: the person's OWN permissions in the business they are working in. Showing or hiding a link
          // is all this is used for — every route checks again on the server.
          working: working ? { businessId: working.businessId, name: working.name, role: working.role, ...viewOf(working, own), home: workspaceHome('VENDOR', viewOf(working, own)) } : null,
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
    const res = NextResponse.json({ success: true, data: { businessId: picked.businessId, home: workspaceHome(picked.kind, viewOf(picked, session.user.vendorId)) } }, noStore);
    res.cookies.set(WORKSPACE_COOKIE, picked.businessId, workspaceCookieOptions);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
