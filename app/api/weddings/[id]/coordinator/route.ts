import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// Who looks after this wedding. Send { coordinatorId: null } to remove them.
const bodySchema = z.object({ coordinatorId: z.string().trim().min(1).nullable() });

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const { coordinatorId } = bodySchema.parse(await req.json());
    const wedding = await weddingWorkspaceService.assignCoordinator(id, coordinatorId, session.user.id ?? null);
    return NextResponse.json({ success: true, data: wedding });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const PATCH = platformScoped(handlePATCH);
