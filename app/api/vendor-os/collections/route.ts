import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueCollectionsService } from '@/services/venueCollections.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET /api/vendor-os/collections — "Money to collect": the business's own bookings with what each couple has paid and still owes.
// Venue-scoped: only this business's own. A money matter — only for a member who may see money.
async function handleGET() {
  try {
    return NextResponse.json({ success: true, data: await venueCollectionsService.get() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, 'view_financials');
