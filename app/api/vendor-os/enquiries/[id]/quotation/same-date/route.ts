import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueSameDateService } from '@/services/venueSameDate.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET /api/vendor-os/enquiries/[id]/quotation/same-date[?date=YYYY-MM-DD] — the business's other bookings on this enquiry's wedding
// date (or on the date given, while one is being picked for the booking). A warning only; nothing is changed. Venue-scoped.
async function handleGET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const data = await venueSameDateService.forEnquiry((await params).id, req.nextUrl.searchParams.get('date'));
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, 'quotations');
