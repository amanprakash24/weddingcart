import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { z } from 'zod';
import { invoiceWorkflowService } from '@/services/invoiceWorkflow.service';
import { MANUAL_PAYMENT_METHODS } from '@/lib/invoice/lifecycle';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { readJsonBody } from '@/lib/readJsonBody';

const bodySchema = z.object({
  amount: z.number().int().positive(),
  method: z.enum(MANUAL_PAYMENT_METHODS as unknown as [string, ...string[]]),
  reference: z.string().trim().max(120).optional(),
  paidAt: z.string().datetime().optional(),
});

// Records money received OUTSIDE Razorpay (cash, UPI, bank transfer, cheque) against one invoice of this wedding.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  const { id, invoiceId } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;
  try {
    const body = bodySchema.parse(await readJsonBody(req));
    const result = await invoiceWorkflowService.recordManualPayment(
      id,
      invoiceId,
      { amount: body.amount, method: body.method as (typeof MANUAL_PAYMENT_METHODS)[number], reference: body.reference, paidAt: body.paidAt ? new Date(body.paidAt) : null },
      session.user.id ?? null
    );
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
