import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { handleApiError } from '@/lib/errors';
import { recordPaymentBody } from '@/lib/commercial/paymentSchema';
import type { ManualPaymentMethod } from '@/lib/invoice/lifecycle';
import { recordPaymentForWedding } from '@/services/commercialFlow.service';
import { platformScoped } from '@/lib/ownership/entry';
import { readJsonBody } from '@/lib/readJsonBody';

// POST /api/weddings/[id]/payments — money received against the wedding's accepted agreement. It is applied to the advance invoice
// first and the rest to the balance invoice, so a payment larger than the 25% is fine and every invoice stays exact.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;
  try {
    const body = recordPaymentBody.parse(await readJsonBody(req));
    const result = await recordPaymentForWedding(
      id,
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
