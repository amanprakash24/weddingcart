import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { vendorWorkOrderService } from '@/services/vendorWorkOrder.service';

// POST /api/weddings/[id]/vendor-bookings/[vbId]/adjustments — { kind, amount, clientPriceDelta?, reason } (money design v1, PR 6).
// A change to an issued work order, never an edit; never below what was paid. Full money access on the wedding.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; vbId: string }> }) {
  const { id, vbId } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;
  try {
    const raw: unknown = await req.json().catch(() => null);
    const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const data = await vendorWorkOrderService.addAdjustment(id, vbId, { kind: body.kind, amount: body.amount, clientPriceDelta: body.clientPriceDelta, reason: body.reason }, session.user.id ?? null);
    return NextResponse.json({ success: true, data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
