import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { payoutService } from '@/services/payout.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// No request body — the payout amount is entirely server-computed from the
// booking's agreedPrice and the current CommissionRate, same "never trust a
// client amount" rule as the invoice/payment-link routes.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; vbId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id, vbId } = await params;
  try {
    const payout = await payoutService.calculatePayoutForBooking(id, vbId, session.user.id ?? null);
    return NextResponse.json({ success: true, data: payout }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
