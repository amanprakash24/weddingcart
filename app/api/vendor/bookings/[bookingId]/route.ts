import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { VenueBookingStatus } from '@/generated/prisma/enums';
import { venuePortalService } from '@/services/venuePortal.service';
import { handleApiError } from '@/lib/errors';

const schema = z.object({ venueStatus: z.nativeEnum(VenueBookingStatus) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const session = await requireRole([Role.VENDOR]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = schema.parse(await req.json());
    return NextResponse.json({ success: true, data: await venuePortalService.updateStatus(session.user.id, (await params).bookingId, body.venueStatus) });
  } catch (error) { return handleApiError(error); }
}
