import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { AvailabilityStatus } from '@/generated/prisma/enums';
import { venuePortalService } from '@/services/venuePortal.service';
import { handleApiError } from '@/lib/errors';

const schema = z.object({
  dates: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
        status: z.nativeEnum(AvailabilityStatus).nullable(),
        note: z.string().max(500).optional(),
      })
    )
    .min(1),
});

export async function PATCH(req: NextRequest) {
  const session = await requireRole([Role.VENDOR]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = schema.parse(await req.json());
    return NextResponse.json({ success: true, data: await venuePortalService.setAvailability(session.user.id, body.dates) });
  } catch (error) {
    return handleApiError(error);
  }
}
