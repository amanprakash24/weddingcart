import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { paymentSubmissionService } from '@/services/paymentSubmission.service';

// GET /api/quotations/[id]/payment-submissions — the couple's "I have paid" claims on this agreement (08-quotation.md §18), newest
// first, each with a screenshot link that expires in minutes. Staff only.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const data = await paymentSubmissionService.listForQuotation((await params).id);
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}
