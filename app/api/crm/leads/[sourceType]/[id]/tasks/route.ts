import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { leadWorkspaceService } from '@/services/leadWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { isSourceType } from '@/lib/crm/subject';

const bodySchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().min(1).optional(),
  dueAt: z.string().datetime().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedToId: z.string().min(1).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ sourceType: string; id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { sourceType, id } = await params;
  if (!isSourceType(sourceType)) {
    return NextResponse.json({ success: false, error: 'Invalid sourceType' }, { status: 400 });
  }

  try {
    const body = bodySchema.parse(await req.json());
    const task = await leadWorkspaceService.addTask(sourceType, id, {
      title: body.title,
      description: body.description,
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      priority: body.priority,
      assignedToId: body.assignedToId,
      createdById: session.user.id ?? null,
    });
    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
