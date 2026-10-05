import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { venueEnquiryService } from '@/services/venueEnquiry.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// POST /api/vendor-os/enquiries/[id]/close — Not going ahead — { reason? }; the enquiry is kept. Venue-scoped; answers with the updated enquiry.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json().catch(() => null);
    const id = (await params).id;
    const actor = (await getSession())?.user?.id ?? null;
    return NextResponse.json({ success: true, data: await venueEnquiryService.close(id, body?.reason, actor) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST);
