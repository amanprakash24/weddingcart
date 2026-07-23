import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';

// PLANNING->ACTIVE is deliberately not selectable here — it's automatic
// (lib/wedding/lifecycle.ts's maybeActivateWedding, fired by a vendor
// confirmation), per domain-model.md §5.2. Every status this route accepts is
// a real coordinator-triggered transition; lib/wedding/lifecycle.ts's
// canTransitionWedding is the single source of truth both this route and the
// UI's dropdown defer to.
const bodySchema = z.object({
  toStatus: z.enum(['POSTPONED', 'ACTIVE', 'PLANNING', 'COMPLETED', 'CANCELLED']),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const { toStatus } = bodySchema.parse(await req.json());
    const wedding = await weddingWorkspaceService.transitionStatus(id, toStatus);
    return NextResponse.json({ success: true, data: wedding });
  } catch (err) {
    return handleApiError(err);
  }
}
