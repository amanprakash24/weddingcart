import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueSpaceService } from '@/services/venueSpace.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// PATCH  /api/vendor-os/spaces/[id] — rename it, change its capacity, or take it out of use / back: { name, capacity?, active? }.
// DELETE /api/vendor-os/spaces/[id] — deleted when nothing was ever reserved in it; otherwise taken out of use (its slots stay).
// Both answer with the whole list. Venue-scoped: another business's hall is "not found".
type Ctx = { params: Promise<{ id: string }> };

async function handlePATCH(req: NextRequest, { params }: Ctx) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await venueSpaceService.update((await params).id, body ?? {});
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handleDELETE(_req: NextRequest, { params }: Ctx) {
  try {
    return NextResponse.json({ success: true, data: await venueSpaceService.remove((await params).id) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const PATCH = venueScoped(handlePATCH, 'settings');
export const DELETE = venueScoped(handleDELETE, 'settings');
