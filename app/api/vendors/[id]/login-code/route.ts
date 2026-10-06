import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { vendorLoginCodeService } from '@/services/vendorLoginCode.service';

// POST /api/vendors/[id]/login-code — an admin issues a new 6-digit login code for a vendor that already has a login (a lost code,
// or a vendor from before codes existed). The old code stops working and the vendor is signed out everywhere. The code is in this
// one answer only — it is stored as a hash and can never be read again.
async function handlePOST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { code, mobile } = await vendorLoginCodeService.issue((await params).id);
    return NextResponse.json({ success: true, loginCode: code, mobile }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
