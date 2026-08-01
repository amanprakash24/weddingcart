import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { paymentService } from '@/services/payment.service';
import { handleApiError } from '@/lib/errors';

// Amount is server-computed from the invoice's outstanding balance — the
// client sends no amount, only an optional notify preference.
const bodySchema = z.object({
  notifyEmail: z.boolean().default(true),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; invoiceId: string }> }) {
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
