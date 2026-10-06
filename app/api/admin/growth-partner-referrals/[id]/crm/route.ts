import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { referralLinkService } from '@/services/referralLink.service';

// POST /api/admin/growth-partner-referrals/[id]/crm — send a referral to where it is worked: a couple → a CRM consultation, a venue or
// vendor → a vendor prospect (lib/growthPartner/crmLink.ts). Body for a couple: { weddingDate?: YYYY-MM-DD, guestCount? }.
// Idempotent. Staff only.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const data = await referralLinkService.sendToCrm((await params).id, { weddingDate: body?.weddingDate, guestCount: body?.guestCount }, session.user.id ?? null);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
