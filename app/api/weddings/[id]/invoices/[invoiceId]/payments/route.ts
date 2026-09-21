import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { invoiceWorkflowService } from '@/services/invoiceWorkflow.service';
import { MANUAL_PAYMENT_METHODS } from '@/lib/invoice/lifecycle';
import { handleApiError } from '@/lib/errors';

const bodySchema = z.object({
  amount: z.number().int().positive(),
  method: z.enum(MANUAL_PAYMENT_METHODS as unknown as [string, ...string[]]),
  reference: z.string().trim().max(120).optional(),
  paidAt: z.string().datetime().optional(),
});

// Records money received OUTSIDE Razorpay (cash, UPI, bank transfer, cheque) against one invoice of this wedding.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { id, invoiceId } = await params;
  try {
    const body = bodySchema.parse(await req.json());
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
