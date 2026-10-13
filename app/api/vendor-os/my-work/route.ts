import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueMyWorkService } from '@/services/venueMyWork.service';
import { MEMBER, venueScoped } from '@/lib/ownership/venueEntry';

// GET /api/vendor-os/my-work — "Your work" on Today: the to-dos on this business's own weddings given to the signed-in person.
// Venue-scoped. Any member may ask — it is their own work, with no phone number and no money in it.
async function handleGET() {
  try {
    return NextResponse.json({ success: true, data: await venueMyWorkService.list() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, MEMBER);
