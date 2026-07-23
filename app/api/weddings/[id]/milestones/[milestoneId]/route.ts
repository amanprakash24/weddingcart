import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';

const bodySchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED']),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; milestoneId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id, milestoneId } = await params;
  try {
    const { status } = bodySchema.parse(await req.json());
    const milestone = await weddingWorkspaceService.updateMilestone(id, milestoneId, status);
    return NextResponse.json({ success: true, data: milestone });
  } catch (err) {
    return handleApiError(err);
  }
}
