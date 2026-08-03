import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { payoutService } from '@/services/payout.service';
import { handleApiError } from '@/lib/errors';

// Only PAID is client-settable this sprint — tracking only, no
// gateway-driven PROCESSING/FAILED transitions exist yet.
const bodySchema = z.object({
  status: z.literal('PAID'),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; payoutId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id, payoutId } = await params;
  try {
    bodySchema.parse(await req.json());
    const payout = await payoutService.markPayoutPaid(id, payoutId, session.user.id ?? null);
    return NextResponse.json({ success: true, data: payout });
  } catch (err) {
    return handleApiError(err);
  }
}
