import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { vendorLoginCodeService } from '@/services/vendorLoginCode.service';

// POST /api/customer/login-code — the couple changes their own My Wedding code: { current, next, confirm }. Same rules as everyone
// else's code (lib/auth/vendorCode.ts). About the signed-in couple's own login only: the user comes from the session.
// A couple whose code was given by their venue should choose their own, so the venue no longer knows it.
const noStore = { headers: { 'Cache-Control': 'no-store' } };

async function handlePOST(req: NextRequest) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Please sign in to My Wedding' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const result = await vendorLoginCodeService.change(session.user.id, { current: body?.current, next: body?.next, confirm: body?.confirm });
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400, ...noStore });
    return NextResponse.json({ success: true }, noStore);
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: entered as Shaadi Shopping (lib/ownership/entry.ts); it touches only the couple's own login.
export const POST = platformScoped(handlePOST);
