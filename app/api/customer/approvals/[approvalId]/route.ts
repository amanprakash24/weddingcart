import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { approvalService } from '@/services/approval.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleApproval } from '@/lib/customer/coupleEntry';

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ approvalId: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { approvalId } = await params;
    const body = await req.json();
    if (body.decision !== 'APPROVED' && body.decision !== 'CHANGES_REQUESTED') {
      return NextResponse.json({ success: false, error: 'Invalid approval decision' }, { status: 400 });
    }
    const userId = session.user.id;
    const data = await asCoupleApproval(approvalId, userId, () => approvalService.decideForClient(approvalId, userId, body.decision, body.comment));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}

// Record ownership: entered as Shaadi Shopping (lib/ownership/entry.ts), then run in the business of the couple's own wedding —
// Shaadi Shopping's or a venue's on Vivah OS (lib/customer/coupleEntry.ts).
export const PATCH = platformScoped(handlePATCH);
