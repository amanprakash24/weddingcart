import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { invoiceWorkflowService } from '@/services/invoiceWorkflow.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// DRAFT → SENT. Sends nothing by itself — it records that the invoice has been issued to the customer.
async function handlePOST(_req: NextRequest, { params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  const { id, invoiceId } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;
  try {
    const invoice = await invoiceWorkflowService.issueInvoice(id, invoiceId, session.user.id ?? null);
    return NextResponse.json({ success: true, data: invoice });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
