import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { venueSpaceService } from '@/services/venueSpace.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// POST /api/vendor-os/calendar/blocks — block a hall's shift by hand: { spaceId, date: YYYY-MM-DD, shift, note? }. Refused (409)
// over a shift that is already booked, accepted or blocked. Venue-scoped.
async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const actor = (await getSession())?.user?.id ?? null;
    const result = await venueSpaceService.block(body ?? {}, actor);
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST, ['weddings', 'quotations']);
