import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { leadWorkspaceService } from '@/services/leadWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { isSourceType } from '@/lib/crm/subject';
import { LOST_REASONS } from '@/lib/crm/pipeline';

const VALID_STAGES = [
  'NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT_SCHEDULED',
  'QUOTATION_SENT', 'NEGOTIATION', 'WON', 'LOST', 'ON_HOLD',
] as const;

const bodySchema = z.object({
  toStage: z.enum(VALID_STAGES),
  // Closed set only enforced when toStage === LOST — validated in the route
  // body below rather than baked into this field's own type, since the same
  // `reason` carries free-text ON_HOLD reasons too.
  reason: z.string().trim().min(1).optional(),
  reasonDetail: z.string().trim().min(1).optional(),
  reviewDate: z.string().datetime().optional(),
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
    const body = bodySchema.parse(await req.json());
    if (body.toStage === 'LOST' && !LOST_REASONS.includes(body.reason as (typeof LOST_REASONS)[number])) {
      return NextResponse.json(
        { success: false, error: `reason must be one of: ${LOST_REASONS.join(', ')}` },
        { status: 400 }
      );
    }

    const subject = await leadWorkspaceService.transitionStage(sourceType, id, {
      toStage: body.toStage,
      reason: body.reason,
      reasonDetail: body.reasonDetail,
      reviewDate: body.reviewDate ? new Date(body.reviewDate) : undefined,
      actorId: session.user.id ?? null,
    });
    return NextResponse.json({ success: true, data: subject });
  } catch (err) {
    return handleApiError(err);
  }
}
