import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { moneyAccessFor } from '@/lib/auth/moneyGuard';
import { canSeeCommission } from '@/lib/auth/moneyAccess';
import { weddingMoneyView } from '@/lib/wedding/moneyView';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// The Wedding Control Room for the whole internal team. Its money is trimmed to what this person may see — the coordinator and
// the founder everything (commission: founder only), the lead's owner the couple's payments read-only, anyone else none
// (lib/auth/moneyAccess.ts, lib/wedding/moneyView.ts). `money` in the response says what was withheld.
async function handleGET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const workspace = await weddingWorkspaceService.getWorkspace(id);
    const access = await moneyAccessFor(session, { wedding: id });
    const seesCommission = canSeeCommission({ userId: session.user.id, roles: session.user.roles });
    return NextResponse.json({ success: true, data: weddingMoneyView(workspace, access, seesCommission) });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
