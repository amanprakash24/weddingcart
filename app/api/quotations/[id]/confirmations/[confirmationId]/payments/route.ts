import { NextRequest, NextResponse } from 'next/server';
import { moneyDenied } from '@/lib/auth/moneyGuard';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { recordPaymentBody } from '@/lib/commercial/paymentSchema';
import type { ManualPaymentMethod } from '@/lib/invoice/lifecycle';
import { confirmationService } from '@/services/confirmation.service';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/quotations/[id]/confirmations/[confirmationId]/payments — money received for one confirmation (PR 8a), recorded by staff:
// its advance invoice first, the rest to its balance invoice. Full money access on the quotation.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; confirmationId: string }> }) {
  const { id, confirmationId } = await params;
  const denied = await moneyDenied({ quotation: id }, 'full');
  if (denied) return denied;
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = recordPaymentBody.parse(await req.json());
    const result = await confirmationService.recordPayment(
      id,
      confirmationId,
      { amount: body.amount, method: body.method as ManualPaymentMethod, reference: body.reference, paidAt: body.paidAt ? new Date(body.paidAt) : null, idempotencyKey: body.idempotencyKey },
      session.user.id ?? null
    );
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
