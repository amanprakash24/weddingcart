import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { vendorPaymentService } from '@/services/vendorPayment.service';

// POST /api/weddings/[id]/vendor-bookings/[vbId]/payments — record one payment made to the vendor for this work: { amount, paidOn
// (YYYY-MM-DD), method, reference?, note? } (25 Nov 2026). Refused above what is left to pay. Full money access only.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; vbId: string }> }) {
  const { id, vbId } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;
  try {
    const raw: unknown = await req.json().catch(() => null);
    const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const payment = await vendorPaymentService.record(id, vbId, { amount: body.amount, paidOn: body.paidOn, method: body.method, reference: body.reference, note: body.note }, session.user.id ?? null);
    return NextResponse.json({ success: true, data: payment }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
