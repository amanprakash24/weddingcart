import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { leadWorkspaceService } from '@/services/leadWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { isSourceType } from '@/lib/crm/subject';
import { platformScoped } from '@/lib/ownership/entry';

// Status-only — not full task editing (title/dueAt/priority edits are out of
// scope this sprint, per the plan's "we'll expand later as editing is added").
const bodySchema = z.object({
  status: z.enum(['DONE', 'CANCELLED']),
});

async function handlePATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sourceType: string; id: string; taskId: string }> }
) {
  if (!(await requireRole(ADMIN_ROLES))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { sourceType, id, taskId } = await params;
  if (!isSourceType(sourceType)) {
    return NextResponse.json({ success: false, error: 'Invalid sourceType' }, { status: 400 });
  }

  try {
    const { status } = bodySchema.parse(await req.json());
    const task = await leadWorkspaceService.completeTask(sourceType, id, taskId, status);
    return NextResponse.json({ success: true, data: task });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const PATCH = platformScoped(handlePATCH);
