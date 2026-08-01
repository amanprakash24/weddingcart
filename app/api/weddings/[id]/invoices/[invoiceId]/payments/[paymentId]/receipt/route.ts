import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { invoiceRepository } from '@/repositories/invoice.repository';
import { weddingRepository } from '@/repositories/wedding.repository';
import { NotFoundError, handleApiError } from '@/lib/errors';

// Structured receipt data only — no PDF rendering. No document-generation
// library exists in this codebase yet, and nothing needs a rendered file
// until Sprint 7.5's customer-facing portal picks this endpoint up.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string; paymentId: string }> }
) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id, invoiceId, paymentId } = await params;
  try {
    const invoice = await invoiceRepository.findById(invoiceId);
    if (!invoice || invoice.weddingId !== id) {
      throw new NotFoundError('Invoice', invoiceId);
    }

    const payment = invoice.payments.find((p) => p.id === paymentId);
    if (!payment) {
      throw new NotFoundError('Payment', paymentId);
    }

    const wedding = await weddingRepository.findById(id);

    return NextResponse.json({
      success: true,
      data: {
        receiptNumber: `RCPT-${payment.id.slice(0, 8).toUpperCase()}`,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        amount: payment.amount,
        method: payment.method,
        paidAt: payment.paidAt,
        razorpayPaymentId: payment.razorpayPaymentId,
        weddingNumber: wedding?.weddingNumber ?? null,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
