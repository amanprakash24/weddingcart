import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueSpaceService } from '@/services/venueSpace.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// DELETE /api/vendor-os/calendar/blocks/[id] — free a shift that was blocked by hand. Only hand blocks: a couple's reservation is
// changed on its enquiry. Venue-scoped: another business's block is "not found".
async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json({ success: true, data: await venueSpaceService.unblock((await params).id) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const DELETE = venueScoped(handleDELETE, ['weddings', 'quotations']);
