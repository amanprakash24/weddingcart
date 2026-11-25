import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { canSeeCommission } from '@/lib/auth/moneyAccess';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { vendorWorkOrderService } from '@/services/vendorWorkOrder.service';

// GET /api/weddings/[id]/work-orders/[woId] — a work order as the team sees it (money design v1, PR 4). Full money access on the
// wedding; commission and margin only for the founder.
async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string; woId: string }> }) {
  const { id, woId } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;
  try {
    const data = await vendorWorkOrderService.forStaff(id, woId, { seesCommission: canSeeCommission({ userId: session.user.id, roles: session.user.roles }) });
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
