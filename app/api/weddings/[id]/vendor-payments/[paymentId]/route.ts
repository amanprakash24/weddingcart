import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { vendorPaymentService } from '@/services/vendorPayment.service';

// PATCH /api/weddings/[id]/vendor-payments/[paymentId] — { void: true, reason }: a wrong payment entry is voided, never edited or
// deleted; it stays in the history with who voided it and why (25 Nov 2026). Full money access only.
async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { id, paymentId } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;
  try {
    const raw: unknown = await req.json().catch(() => null);
    const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    if (body.void !== true) return NextResponse.json({ success: false, error: 'A payment entry can only be voided' }, { status: 400 });
    const payment = await vendorPaymentService.voidPayment(id, paymentId, body.reason, session.user.id ?? null);
    return NextResponse.json({ success: true, data: payment }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const PATCH = platformScoped(handlePATCH);
