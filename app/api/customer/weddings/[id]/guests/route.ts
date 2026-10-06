import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { guestService } from '@/services/guest.service';
import { handleApiError } from '@/lib/errors';
import { GuestRsvpStatus } from '@/generated/prisma/enums';
import { platformScoped } from '@/lib/ownership/entry';

const schema = z.object({
  name: z.string().trim().min(1), phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')), category: z.string().optional(),
  accompanyingGuests: z.coerce.number().int().min(0).max(20).default(0),
  rsvpStatus: z.nativeEnum(GuestRsvpStatus).default(GuestRsvpStatus.PENDING),
  notes: z.string().optional(),
  functionResponses: z.array(z.object({ weddingEventId: z.string().min(1), status: z.nativeEnum(GuestRsvpStatus) })).default([]),
});

async function handleGET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ success: true, data: await guestService.listForClient((await params).id, session.user.id) }); } catch (error) { return handleApiError(error); }
}

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = schema.parse(await req.json());
    await guestService.listForClient((await params).id, session.user.id);
    return NextResponse.json({ success: true, data: await guestService.create((await params).id, body) }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const POST = platformScoped(handlePOST);
