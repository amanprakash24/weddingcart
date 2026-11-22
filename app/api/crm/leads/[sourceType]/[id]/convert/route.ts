import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { canAssignWork } from '@/lib/auth/moneyAccess';
import { moneyDenied } from '@/lib/auth/moneyGuard';
import { convertLeadToWedding } from '@/services/weddingConversion.service';
import { handleApiError } from '@/lib/errors';
import { isSourceType } from '@/lib/crm/subject';
import { platformScoped } from '@/lib/ownership/entry';

const bodySchema = z.object({
  weddingDate: z.string().datetime(),
  city: z.string().trim().min(1, 'City is required'),
  venueName: z.string().trim().min(1).optional(),
  coordinatorId: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  // Ignored since Money v1 (the server decides from the recorded payments); still accepted so an older client keeps working.
  tokenAdvanceReceived: z.boolean().optional(),
});

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ sourceType: string; id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { sourceType, id } = await params;
  if (!isSourceType(sourceType)) {
    return NextResponse.json({ success: false, error: 'Invalid sourceType' }, { status: 400 });
  }

  // Booking it creates the wedding's invoices: the person the lead is assigned to (or the founder) does that.
  const denied = await moneyDenied({ source: { sourceType, id } }, 'full');
  if (denied) return denied;

  try {
    const body = bodySchema.parse(await req.json());
    // Choosing the coordinator decides who sees the wedding's money — founder only (lib/auth/moneyAccess.ts).
    if (body.coordinatorId && !canAssignWork({ userId: session.user.id, roles: session.user.roles })) {
      return NextResponse.json({ success: false, error: 'Only the founder can choose the coordinator' }, { status: 403 });
    }
    const wedding = await convertLeadToWedding(
      sourceType,
      id,
      { ...body, weddingDate: new Date(body.weddingDate) },
      session.user.id ?? null
    );
    return NextResponse.json({ success: true, data: wedding }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
