import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { leadWorkspaceService } from '@/services/leadWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { isSourceType } from '@/lib/crm/subject';

const bodySchema = z.object({
  detail: z.string().trim().min(1, 'Note text is required'),
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
    const { detail } = bodySchema.parse(await req.json());
    const note = await leadWorkspaceService.addNote(sourceType, id, {
      detail,
      performedById: session.user.id ?? null,
    });
    return NextResponse.json({ success: true, data: note }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
