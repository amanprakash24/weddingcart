import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueMyWorkService } from '@/services/venueMyWork.service';
import { MEMBER, venueScoped } from '@/lib/ownership/venueEntry';

// PATCH /api/vendor-os/my-work/[taskId] — { done: true | false }: the person a to-do was given to ticks or unticks it. Venue-scoped.
// Any member — but only a to-do that is their own (venueMyWorkService.setDone); anyone else's is "not found".
async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const body = (await req.json().catch(() => ({}))) ?? {};
    return NextResponse.json({ success: true, data: await venueMyWorkService.setDone((await params).taskId, body.done) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const PATCH = venueScoped(handlePATCH, MEMBER);
