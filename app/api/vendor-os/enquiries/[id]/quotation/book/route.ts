import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { venueQuotationService } from '@/services/venueQuotation.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// POST /api/vendor-os/enquiries/[id]/quotation/book — { weddingDate? } — make the booking for an accepted quotation when it could not
// be made on its own (the enquiry had no wedding date). Venue-scoped.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json().catch(() => null);
    const actor = (await getSession())?.user?.id ?? null;
    return NextResponse.json({ success: true, data: await venueQuotationService.book((await params).id, { weddingDate: body?.weddingDate }, actor) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST, 'quotations');
