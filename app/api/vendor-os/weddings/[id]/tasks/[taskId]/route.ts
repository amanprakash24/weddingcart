import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueWeddingService } from '@/services/venueWedding.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// PATCH /api/vendor-os/weddings/[id]/tasks/[taskId] — { done: true | false } ticks or unticks a to-do; { remove: true } takes it off
// the list (it is kept as cancelled, never deleted); { assignTo: a team member's id | null } gives it to someone, or to nobody —
// that one also needs the `tasks` permission, checked in the service. Venue-scoped.
async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  try {
    const { id, taskId } = await params;
    const body = (await req.json().catch(() => ({}))) ?? {};
    if (body.assignTo !== undefined) return NextResponse.json({ success: true, data: await venueWeddingService.assignTask(id, taskId, body.assignTo) });
    return NextResponse.json({ success: true, data: await venueWeddingService.setTask(id, taskId, { done: body.done, remove: body.remove }) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const PATCH = venueScoped(handlePATCH, 'weddings');
