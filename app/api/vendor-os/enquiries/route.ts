import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { venueEnquiryService } from '@/services/venueEnquiry.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET  /api/vendor-os/enquiries — the venue's own enquiries ("Your Enquiries"), what needs doing first at the top.
// POST /api/vendor-os/enquiries — "+ New Enquiry": { name, phone, weddingDate?, guestCount?, need?, channel }.
// Venue-scoped (lib/ownership/venueEntry.ts): only the logged-in venue's own records, created in its business.
async function handleGET() {
  try {
    return NextResponse.json({ success: true, data: await venueEnquiryService.list() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await venueEnquiryService.create(body ?? {}, (await getSession())?.user?.id ?? null);
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, 'enquiries');
export const POST = venueScoped(handlePOST, 'enquiries');
