import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';

// Any of these may be sent; only what is sent changes. `status` alone keeps working exactly as before (Done / Cancelled), and now also
// PENDING / IN_PROGRESS to reopen a task. `dueAt`, `assignedToId` and `description` may be null to clear them.
const bodySchema = z
  .object({
    status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED']),
    title: z.string().trim().min(1, 'A task needs a title'),
    description: z.string().trim().nullable(),
    dueAt: z.string().datetime().nullable(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    assignedToId: z.string().trim().min(1).nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id, taskId } = await params;
  try {
    const body = bodySchema.parse(await req.json());
    const task = await weddingWorkspaceService.updateTask(id, taskId, {
      ...body,
      dueAt: body.dueAt === undefined ? undefined : body.dueAt === null ? null : new Date(body.dueAt),
    });
    return NextResponse.json({ success: true, data: task });
  } catch (err) {
    return handleApiError(err);
  }
}
