import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { venueEnquiryService } from '@/services/venueEnquiry.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET   /api/vendor-os/enquiries/[id] — one of the venue's own enquiries, with its next step, follow-ups and history.
// PATCH /api/vendor-os/enquiries/[id] — { handledBy }: hand the enquiry to someone who may work enquiries ('' = nobody in
//       particular). Only the owner or a member who gives out work (services/venuePeople.ts `assignee` checks it).
// Another business's enquiry answers exactly like a missing one.
async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json({ success: true, data: await venueEnquiryService.get((await params).id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json().catch(() => ({}));
    const data = await venueEnquiryService.handOver((await params).id, body?.handledBy, (await getSession())?.user?.id ?? null);
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, 'enquiries');
export const PATCH = venueScoped(handlePATCH, 'enquiries');
