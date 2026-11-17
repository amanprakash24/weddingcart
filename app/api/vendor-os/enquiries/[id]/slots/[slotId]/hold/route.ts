import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { venueSpaceService } from '@/services/venueSpace.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// POST   /api/vendor-os/enquiries/[id]/slots/[slotId]/hold — hold this enquiry's hall for the couple, or extend the hold: { days }.
//        Refused (409) when the hall is already booked, accepted, held or blocked for that shift. The hold ends by itself.
// DELETE /api/vendor-os/enquiries/[id]/slots/[slotId]/hold — end the hold now. Both answer with the enquiry's halls. Venue-scoped.
type Ctx = { params: Promise<{ id: string; slotId: string }> };

async function handlePOST(req: NextRequest, { params }: Ctx) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, slotId } = await params;
    const actor = (await getSession())?.user?.id ?? null;
    return NextResponse.json({ success: true, data: await venueSpaceService.hold(id, slotId, body ?? {}, actor) });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handleDELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id, slotId } = await params;
    return NextResponse.json({ success: true, data: await venueSpaceService.releaseHold(id, slotId) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST, 'quotations');
export const DELETE = venueScoped(handleDELETE, 'quotations');
