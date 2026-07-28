import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { convertLeadToWedding } from '@/services/weddingConversion.service';
import { handleApiError } from '@/lib/errors';
import { isSourceType } from '@/lib/crm/subject';

const bodySchema = z.object({
  weddingDate: z.string().datetime(),
  city: z.string().trim().min(1, 'City is required'),
  venueName: z.string().trim().min(1).optional(),
  coordinatorId: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  tokenAdvanceReceived: z.boolean(),
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
