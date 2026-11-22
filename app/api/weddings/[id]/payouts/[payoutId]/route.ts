import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { withoutCommission } from '@/lib/auth/moneyAccess';
import { z } from 'zod';
import { payoutService } from '@/services/payout.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// Only PAID is client-settable this sprint — tracking only, no
// gateway-driven PROCESSING/FAILED transitions exist yet.
const bodySchema = z.object({
  status: z.literal('PAID'),
});

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string; payoutId: string }> }) {
  const { id, payoutId } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;
  try {
    bodySchema.parse(await req.json());
    const payout = await payoutService.markPayoutPaid(id, payoutId, session.user.id ?? null);
    return NextResponse.json({ success: true, data: withoutCommission({ userId: session.user.id, roles: session.user.roles }, payout) });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const PATCH = platformScoped(handlePATCH);
