import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueMyWorkService } from '@/services/venueMyWork.service';
import { MEMBER, venueScoped } from '@/lib/ownership/venueEntry';

// POST /api/vendor-os/my-work/[taskId]/notes — { note }: the person a to-do was given to writes a note about it. It is kept in
// the wedding's history under their name. Venue-scoped. Any member — but only on a to-do that is their own
// (venueMyWorkService.addNote); anyone else's is "not found".
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const body = (await req.json().catch(() => ({}))) ?? {};
    return NextResponse.json({ success: true, data: await venueMyWorkService.addNote((await params).taskId, body.note) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST, MEMBER);
