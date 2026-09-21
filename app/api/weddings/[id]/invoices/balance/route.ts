import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { invoiceWorkflowService } from '@/services/invoiceWorkflow.service';
import { handleApiError } from '@/lib/errors';

// Creates the balance invoice (total − advance) from the wedding's ACCEPTED quotation. No body: nothing is client-supplied, so an
// old or edited figure can never reach the invoice.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const invoice = await invoiceWorkflowService.createBalanceInvoice(id, session.user.id ?? null);
    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
