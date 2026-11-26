import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { GuestRsvpStatus } from '@/generated/prisma/enums';
import { guestService } from '@/services/guest.service';
import { handleApiError } from '@/lib/errors';
import { rsvpScoped } from '@/lib/guest/rsvpEntry';
import { readJsonBody } from '@/lib/readJsonBody';

const schema = z.object({
  rsvpStatus: z.nativeEnum(GuestRsvpStatus),
  accompanyingGuests: z.coerce.number().int().min(0).max(20),
  functionResponses: z.array(z.object({ weddingEventId: z.string().min(1), status: z.nativeEnum(GuestRsvpStatus) })).default([]),
});

async function handleGET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const guest = await guestService.getPublicByToken((await params).token);
  if (!guest) return NextResponse.json({ success: false, error: 'RSVP link not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: guest });
}

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const body = schema.parse(await readJsonBody(req));
    return NextResponse.json({ success: true, data: await guestService.submitPublic((await params).token, body) });
  } catch (error) { return handleApiError(error); }
}

// Record ownership: runs as the business whose wedding this guest is on (lib/guest/rsvpEntry.ts).
export const GET = rsvpScoped(handleGET);
export const PATCH = rsvpScoped(handlePATCH);
