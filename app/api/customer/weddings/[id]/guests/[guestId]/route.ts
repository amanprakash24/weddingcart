import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { GuestRsvpStatus } from '@/generated/prisma/enums';
import { guestService } from '@/services/guest.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';

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

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string; guestId: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = schema.parse(await req.json());
    const { id, guestId } = await params;
    const userId = session.user.id;
    const updated = await asCoupleWedding(id, userId, async () => {
      await guestService.listForClient(id, userId);
      return guestService.update(id, guestId, body);
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) { return handleApiError(error); }
}

async function handleDELETE(_req: Request, { params }: { params: Promise<{ id: string; guestId: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id, guestId } = await params;
    const userId = session.user.id;
    await asCoupleWedding(id, userId, async () => {
      await guestService.listForClient(id, userId);
      await guestService.remove(id, guestId);
    });
    return NextResponse.json({ success: true });
  } catch (error) { return handleApiError(error); }
}

// Record ownership: entered as Shaadi Shopping (lib/ownership/entry.ts), then run in the business of the couple's own wedding —
// Shaadi Shopping's or a venue's on Vivah OS (lib/customer/coupleEntry.ts).
export const PATCH = platformScoped(handlePATCH);
export const DELETE = platformScoped(handleDELETE);
