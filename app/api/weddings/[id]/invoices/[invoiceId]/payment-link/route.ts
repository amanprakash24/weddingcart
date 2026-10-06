import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { paymentService } from '@/services/payment.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// Amount is server-computed from the invoice's outstanding balance — the
// client sends no amount, only an optional notify preference.
const bodySchema = z.object({
  notifyEmail: z.boolean().default(true),
});

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id, invoiceId } = await params;
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
