import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { z } from 'zod';
import { paymentService } from '@/services/payment.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// Amount is server-computed from the invoice's outstanding balance — the
// client sends no amount, only an optional notify preference.
const bodySchema = z.object({
  notifyEmail: z.boolean().default(true),
});

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  const { id, invoiceId } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;
  try {
    bodySchema.parse(await req.json().catch(() => ({})));
    const link = await paymentService.createPaymentLinkForInvoice(id, invoiceId, session.user.id ?? null);
    return NextResponse.json({ success: true, data: link }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
