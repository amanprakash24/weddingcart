import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { invoiceWorkflowService } from '@/services/invoiceWorkflow.service';
import { handleApiError } from '@/lib/errors';

// DRAFT → SENT. Sends nothing by itself — it records that the invoice has been issued to the customer.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { id, invoiceId } = await params;
  try {
    const invoice = await invoiceWorkflowService.issueInvoice(id, invoiceId, session.user.id ?? null);
    return NextResponse.json({ success: true, data: invoice });
  } catch (err) {
    return handleApiError(err);
  }
}
