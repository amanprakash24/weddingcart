import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueEnquiryService } from '@/services/venueEnquiry.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET /api/vendor-os/enquiries/[id] — one of the venue's own enquiries, with its next step, follow-ups and history.
// Another business's enquiry answers exactly like a missing one.
async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json({ success: true, data: await venueEnquiryService.get((await params).id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET);
