import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { leadWorkspaceService } from '@/services/leadWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { isSourceType } from '@/lib/crm/subject';

const bodySchema = z.object({
  assignedToId: z.string().min(1).nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ sourceType: string; id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { sourceType, id } = await params;
  if (!isSourceType(sourceType)) {
    return NextResponse.json({ success: false, error: 'Invalid sourceType' }, { status: 400 });
  }

  try {
    const { assignedToId } = bodySchema.parse(await req.json());
    const subject = await leadWorkspaceService.assignLead(sourceType, id, {
      assignedToId,
      actorId: session.user.id ?? null,
    });
    return NextResponse.json({ success: true, data: subject });
  } catch (err) {
    return handleApiError(err);
  }
}
