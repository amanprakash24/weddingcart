import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueWeddingService } from '@/services/venueWedding.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET /api/vendor-os/weddings/[id] — one of the business's own weddings: functions, what was agreed, tasks and (for someone who
// may see money) what was received. Another business's wedding is "not found". Venue-scoped.
async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json({ success: true, data: await venueWeddingService.get((await params).id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, 'weddings');
