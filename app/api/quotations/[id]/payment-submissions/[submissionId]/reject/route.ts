import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { paymentSubmissionService } from '@/services/paymentSubmission.service';

// POST /api/quotations/[id]/payment-submissions/[submissionId]/reject — staff could not match the payment. Body: { reason } — shown to
// the couple on their link. Nothing about money changes.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; submissionId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const input = await req.json().catch(() => null);
    const { id, submissionId } = await params;
    const data = await paymentSubmissionService.reject(id, submissionId, input?.reason, session.user.id ?? null);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return handleApiError(err);
  }
}
