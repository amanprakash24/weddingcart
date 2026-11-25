import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { canSeeCommission } from '@/lib/auth/moneyAccess';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { vendorPaymentService } from '@/services/vendorPayment.service';

// GET /api/weddings/[id]/vendor-money — vendor by vendor: work value, paid, left to pay, work status and every payment (25 Nov
// 2026). Vendor money is for full money access (coordinator, founder); Shaadi Shopping's commission for the founder only.
async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;
  try {
    const data = await vendorPaymentService.forWedding(id, { seesCommission: canSeeCommission({ userId: session.user.id, roles: session.user.roles }) });
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
