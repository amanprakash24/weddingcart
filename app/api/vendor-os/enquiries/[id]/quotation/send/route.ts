import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { venueQuotationService } from '@/services/venueQuotation.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// POST /api/vendor-os/enquiries/[id]/quotation/send — send the draft and make the couple's link. Answers with the quotation and
// linkPath (/proposal/<token>) — shown this once; only its hash is stored. Venue-scoped.
async function handlePOST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = (await getSession())?.user?.id ?? null;
    return NextResponse.json({ success: true, data: await venueQuotationService.send((await params).id, actor) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST, 'quotations');
