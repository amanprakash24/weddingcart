import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueGettingStartedService } from '@/services/venueGettingStarted.service';
import { MEMBER, venueScoped } from '@/lib/ownership/venueEntry';

// GET /api/vendor-os/getting-started — the "Getting started" list on Today: which of the first things (price list, UPI ID, first
// enquiry, first quotation) the business has done. Venue-scoped: only this business's own. Any member may ask — the answer holds
// no names and no money, and offers each person only the lines they may do.
async function handleGET() {
  try {
    return NextResponse.json({ success: true, data: await venueGettingStartedService.get() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, MEMBER);
