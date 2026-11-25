import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { canSeeCommission } from '@/lib/auth/moneyAccess';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { vendorWorkOrderService } from '@/services/vendorWorkOrder.service';

// PATCH /api/weddings/[id]/vendor-bookings/[vbId]/pricing — { model: 'COMMISSION' | 'FIXED', vendorPrice?, acceptNegativeMargin?,
// reason? } (money design v1, PR 4). Founder only — the choice decides our margin. Refused once the work order is issued.
async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string; vbId: string }> }) {
  const { id, vbId } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;
  if (!canSeeCommission({ userId: session.user.id, roles: session.user.roles })) return NextResponse.json({ success: false, error: 'Only the founder can set how a vendor is paid' }, { status: 403 });
  try {
    const raw: unknown = await req.json().catch(() => null);
    const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const data = await vendorWorkOrderService.setPricing(id, vbId, { model: body.model, vendorPrice: body.vendorPrice, acceptNegativeMargin: body.acceptNegativeMargin, reason: body.reason }, session.user.id ?? null);
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const PATCH = platformScoped(handlePATCH);
