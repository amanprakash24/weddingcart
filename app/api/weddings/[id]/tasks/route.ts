import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';

const bodySchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().min(1).optional(),
  dueAt: z.string().datetime().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedToId: z.string().trim().min(1).optional(),
  weddingEventId: z.string().trim().min(1).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = bodySchema.parse(await req.json());
    const task = await weddingWorkspaceService.addTask(id, {
      ...body,
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      createdById: session.user.id ?? null,
    });
    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
