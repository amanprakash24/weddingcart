import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';

const bodySchema = z.object({
  detail: z.string().trim().min(1, 'Note text is required'),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const { detail } = bodySchema.parse(await req.json());
    const note = await weddingWorkspaceService.addNote(id, { detail, performedById: session.user.id ?? null });
    return NextResponse.json({ success: true, data: note }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
