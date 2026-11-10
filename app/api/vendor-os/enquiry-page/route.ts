import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueScoped } from '@/lib/ownership/venueEntry';
import { enquiryPageService } from '@/services/enquiryPage.service';

// GET /api/vendor-os/enquiry-page — the venue's own public enquiry page address (made the first time it is asked for), for the
// "Your enquiry page" card on Enquiries. Venue-scoped, `enquiries` permission: the address is the business's own.
async function handleGET() {
  try {
    const slug = await enquiryPageService.ensureSlug();
    return NextResponse.json({ success: true, data: { path: `/enquire/${slug}` } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, 'enquiries');
