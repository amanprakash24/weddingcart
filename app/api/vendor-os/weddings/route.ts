import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueWeddingService } from '@/services/venueWedding.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET /api/vendor-os/weddings — the business's own weddings (its confirmed bookings), upcoming first. Venue-scoped.
async function handleGET() {
  try {
    return NextResponse.json({ success: true, data: await venueWeddingService.list() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, 'weddings');
