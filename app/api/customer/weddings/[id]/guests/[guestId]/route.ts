import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { GuestRsvpStatus } from '@/generated/prisma/enums';
import { guestService } from '@/services/guest.service';
import { handleApiError } from '@/lib/errors';

const schema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  category: z.string().optional(),
  accompanyingGuests: z.coerce.number().int().min(0).max(20).default(0),
  rsvpStatus: z.nativeEnum(GuestRsvpStatus).default(GuestRsvpStatus.PENDING),
  notes: z.string().optional(),
  functionResponses: z.array(z.object({ weddingEventId: z.string().min(1), status: z.nativeEnum(GuestRsvpStatus) })).default([]),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; guestId: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = schema.parse(await req.json());
    const { id, guestId } = await params;
    await guestService.listForClient(id, session.user.id);
    return NextResponse.json({ success: true, data: await guestService.update(id, guestId, body) });
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; guestId: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id, guestId } = await params;
    await guestService.listForClient(id, session.user.id);
    await guestService.remove(id, guestId);
    return NextResponse.json({ success: true });
  } catch (error) { return handleApiError(error); }
}
