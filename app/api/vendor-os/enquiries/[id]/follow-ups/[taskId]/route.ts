import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueEnquiryService } from '@/services/venueEnquiry.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// PATCH /api/vendor-os/enquiries/[id]/follow-ups/[taskId] — mark a follow-up done. Venue-scoped; answers with the updated enquiry.
async function handlePATCH(_req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  try {
    const { id, taskId } = await params;
    return NextResponse.json({ success: true, data: await venueEnquiryService.completeFollowUp(id, taskId) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const PATCH = venueScoped(handlePATCH, 'enquiries');
