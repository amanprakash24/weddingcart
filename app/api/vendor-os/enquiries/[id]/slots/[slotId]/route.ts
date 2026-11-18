import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueSpaceService } from '@/services/venueSpace.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// DELETE /api/vendor-os/enquiries/[id]/slots/[slotId] — this enquiry no longer reserves that hall and shift. Answers with the list.
async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; slotId: string }> }) {
  try {
    const { id, slotId } = await params;
    return NextResponse.json({ success: true, data: await venueSpaceService.release(id, slotId) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const DELETE = venueScoped(handleDELETE, 'quotations');
