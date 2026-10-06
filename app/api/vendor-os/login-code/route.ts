import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { vendorLoginCodeService } from '@/services/vendorLoginCode.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET  /api/vendor-os/login-code — does this login have a code, when was it set, and is it time for the monthly reminder.
// POST /api/vendor-os/login-code — the vendor changes their own code: { current, next, confirm }.
// About the logged-in vendor's own login only: the user comes from the session, never from the request.
const noStore = { headers: { 'Cache-Control': 'no-store' } };
const loggedOut = () => NextResponse.json({ success: false, error: 'Please log in to your Vivah OS account' }, { status: 401 });

async function handleGET() {
  const session = await requireRole([Role.VENDOR]);
  if (!session?.user?.id) return loggedOut();
  try {
    const { hasCode, setAt, reminder } = await vendorLoginCodeService.status(session.user.id);
    return NextResponse.json({ success: true, data: { hasCode, setAt: setAt?.toISOString() ?? null, reminder } }, noStore);
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePOST(req: NextRequest) {
  const session = await requireRole([Role.VENDOR]);
  if (!session?.user?.id) return loggedOut();
  try {
    const body = await req.json().catch(() => ({}));
    const result = await vendorLoginCodeService.change(session.user.id, { current: body?.current, next: body?.next, confirm: body?.confirm });
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400, ...noStore });
    return NextResponse.json({ success: true }, noStore);
  } catch (err) {
    return handleApiError(err);
  }
}

// Vendor logins only, running as the vendor's own business (lib/ownership/venueEntry.ts). The code belongs to the login, not to the
// business's records — the handlers read the user from the session themselves.
export const GET = venueScoped(handleGET);
export const POST = venueScoped(handlePOST);
