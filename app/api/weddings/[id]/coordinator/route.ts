import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { canAssignWork } from '@/lib/auth/moneyAccess';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { readJsonBody } from '@/lib/readJsonBody';

// Who looks after this wedding. Send { coordinatorId: null } to remove them.
const bodySchema = z.object({ coordinatorId: z.string().trim().min(1).nullable() });

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  // The coordinator sees and works the wedding's money, so only the founder chooses them (lib/auth/moneyAccess.ts).
  if (!canAssignWork({ userId: session.user.id, roles: session.user.roles })) {
    return NextResponse.json({ success: false, error: 'Only the founder can choose the coordinator' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const { coordinatorId } = bodySchema.parse(await readJsonBody(req));
    const wedding = await weddingWorkspaceService.assignCoordinator(id, coordinatorId, session.user.id ?? null);
    return NextResponse.json({ success: true, data: wedding });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const PATCH = platformScoped(handlePATCH);
