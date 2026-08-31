import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { approvalService } from '@/services/approval.service';
import { handleApiError } from '@/lib/errors';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; approvalId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id, approvalId } = await params;
    const body = await req.json();
    if (body.status !== 'CANCELLED') return NextResponse.json({ success: false, error: 'Only cancellation is supported' }, { status: 400 });
    return NextResponse.json({ success: true, data: await approvalService.cancel(approvalId, id, session.user.id) });
  } catch (error) {
    return handleApiError(error);
  }
}
