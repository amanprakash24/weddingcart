import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { recordPaymentBody } from '@/lib/commercial/paymentSchema';
import type { ManualPaymentMethod } from '@/lib/invoice/lifecycle';
import { recordPaymentForQuotation } from '@/services/commercialFlow.service';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/quotations/[id]/payments — money received for an ACCEPTED quotation (cash / UPI / bank transfer / cheque), recorded by staff.
// Works before the booking is confirmed and before any wedding exists: this is how a partial payment holds the date and how the 25%
// needed to confirm the booking arrives. Nothing is sent to the customer and no payment provider is called.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = recordPaymentBody.parse(await req.json());
    const result = await recordPaymentForQuotation(
      (await params).id,
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
