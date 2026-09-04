import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { approvalService } from '@/services/approval.service';
import { handleApiError } from '@/lib/errors';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ approvalId: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { approvalId } = await params;
    const body = await req.json();
    if (body.decision !== 'APPROVED' && body.decision !== 'CHANGES_REQUESTED') {
      return NextResponse.json({ success: false, error: 'Invalid approval decision' }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: await approvalService.decideForClient(approvalId, session.user.id, body.decision, body.comment) });
  } catch (error) {
    return handleApiError(error);
  }
}
