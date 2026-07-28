import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';

const bodySchema = z.object({
  status: z.enum(['DONE', 'CANCELLED']),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id, taskId } = await params;
  try {
    const { status } = bodySchema.parse(await req.json());
    const task = await weddingWorkspaceService.completeTask(id, taskId, status);
    return NextResponse.json({ success: true, data: task });
  } catch (err) {
    return handleApiError(err);
  }
}
