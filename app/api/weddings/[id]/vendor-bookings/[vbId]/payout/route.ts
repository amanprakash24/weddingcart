import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { withoutCommission } from '@/lib/auth/moneyAccess';
import { payoutService } from '@/services/payout.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// No request body — the payout amount is entirely server-computed from the
// booking's agreedPrice and the current CommissionRate, same "never trust a
// client amount" rule as the invoice/payment-link routes.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; vbId: string }> }) {
  const { id, vbId } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;
  try {
    const payout = await payoutService.calculatePayoutForBooking(id, vbId, session.user.id ?? null);
    return NextResponse.json(
      { success: true, data: withoutCommission({ userId: session.user.id, roles: session.user.roles }, payout) },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
