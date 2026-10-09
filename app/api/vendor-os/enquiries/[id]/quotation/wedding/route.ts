import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueQuotationService } from '@/services/venueQuotation.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// POST /api/vendor-os/enquiries/[id]/quotation/wedding — create the wedding for a confirmed booking that has none yet. Pressing it
// twice changes nothing: the booking keeps its one wedding. Venue-scoped.
async function handlePOST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json({ success: true, data: await venueQuotationService.createWedding((await params).id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST, 'weddings');
