import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueEnquiryService } from '@/services/venueEnquiry.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET /api/vendor-os/enquiries/to-check — how many "I have paid" claims from the business's own couples are waiting to be checked.
// For the mark on "Enquiries" in the menu. 0 for a member who may not see money. Venue-scoped: only this business's own.
async function handleGET() {
  try {
    return NextResponse.json({ success: true, data: { paymentsToCheck: await venueEnquiryService.paymentsToCheck() } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, 'enquiries');
