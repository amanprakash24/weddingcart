import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { moneyAccessFor } from '@/lib/auth/moneyGuard';
import { maskAmounts } from '@/lib/wedding/moneyView';
import { leadWorkspaceService } from '@/services/leadWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { isSourceType } from '@/lib/crm/subject';
import { platformScoped } from '@/lib/ownership/entry';

async function handleGET(req: NextRequest, { params }: { params: Promise<{ sourceType: string; id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { sourceType, id } = await params;
  if (!isSourceType(sourceType)) {
    return NextResponse.json({ success: false, error: 'Invalid sourceType' }, { status: 400 });
  }

  try {
    const workspace = await leadWorkspaceService.getWorkspace(sourceType, id);
    // The lead is open to the whole team; its money is not. For anyone it is not assigned to, amounts written into the timeline
    // (quotes sent, payments) are masked — the quotes themselves are refused by /api/quotations (lib/auth/moneyAccess.ts).
    const moneyAccess = await moneyAccessFor(session, { source: { sourceType, id } });
    const data =
      moneyAccess === 'none'
        ? { ...workspace, timeline: workspace.timeline.map((e) => ({ ...e, summary: maskAmounts(e.summary), detail: maskAmounts(e.detail) })) }
        : workspace;
    return NextResponse.json({ success: true, data: { ...data, moneyAccess } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
