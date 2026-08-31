import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { GuestRsvpStatus } from '@/generated/prisma/enums';
import { guestService } from '@/services/guest.service';
import { handleApiError } from '@/lib/errors';

const responseSchema = z.object({ weddingEventId: z.string().min(1), status: z.nativeEnum(GuestRsvpStatus) });
const guestSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  category: z.string().optional(),
  accompanyingGuests: z.coerce.number().int().min(0).max(20).default(0),
  rsvpStatus: z.nativeEnum(GuestRsvpStatus).default(GuestRsvpStatus.PENDING),
  notes: z.string().optional(),
  functionResponses: z.array(responseSchema).default([]),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ success: true, data: await guestService.listForAdmin((await params).id) }); } catch (error) { return handleApiError(error); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = guestSchema.parse(await req.json());
    return NextResponse.json({ success: true, data: await guestService.create((await params).id, body) }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}
