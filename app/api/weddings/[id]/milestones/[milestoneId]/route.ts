import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { readJsonBody } from '@/lib/readJsonBody';

const bodySchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED']),
});

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string; milestoneId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id, milestoneId } = await params;
  try {
    const { status } = bodySchema.parse(await readJsonBody(req));
    const milestone = await weddingWorkspaceService.updateMilestone(id, milestoneId, status);
    return NextResponse.json({ success: true, data: milestone });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const PATCH = platformScoped(handlePATCH);
