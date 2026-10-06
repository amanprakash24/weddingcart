import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { recordPaymentBody } from '@/lib/commercial/paymentSchema';
import type { ManualPaymentMethod } from '@/lib/invoice/lifecycle';
import { recordPaymentForWedding } from '@/services/commercialFlow.service';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/weddings/[id]/payments — money received against the wedding's accepted agreement. It is applied to the advance invoice
// first and the rest to the balance invoice, so a payment larger than the 25% is fine and every invoice stays exact.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = recordPaymentBody.parse(await req.json());
    const result = await recordPaymentForWedding(
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
