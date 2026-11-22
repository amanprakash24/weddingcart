import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { canAssignWork } from '@/lib/auth/moneyAccess';
import { leadWorkspaceService } from '@/services/leadWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { isSourceType } from '@/lib/crm/subject';
import { platformScoped } from '@/lib/ownership/entry';

const bodySchema = z.object({
  assignedToId: z.string().min(1).nullable(),
});

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ sourceType: string; id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  // Who a lead is assigned to decides who sees its money, so only the founder assigns (lib/auth/moneyAccess.ts).
  if (!canAssignWork({ userId: session.user.id, roles: session.user.roles })) {
    return NextResponse.json({ success: false, error: 'Only the founder can assign leads' }, { status: 403 });
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

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const PATCH = platformScoped(handlePATCH);
