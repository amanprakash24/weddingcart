import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueEnquiryService } from '@/services/venueEnquiry.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// PATCH /api/vendor-os/enquiries/[id]/follow-ups/[taskId] — mark a follow-up done; or, with { assignTo: a team member's id | null },
// give it to someone or to nobody (that also needs the `tasks` permission, checked in the service). Venue-scoped; answers with
// the updated enquiry.
async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  try {
    const { id, taskId } = await params;
    const body = (await req.json().catch(() => ({}))) ?? {};
    if (body.assignTo !== undefined) return NextResponse.json({ success: true, data: await venueEnquiryService.assignFollowUp(id, taskId, body.assignTo) });
    return NextResponse.json({ success: true, data: await venueEnquiryService.completeFollowUp(id, taskId) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const PATCH = venueScoped(handlePATCH, 'enquiries');
