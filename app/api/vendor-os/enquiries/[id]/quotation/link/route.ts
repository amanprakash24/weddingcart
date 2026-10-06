import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { venueQuotationService } from '@/services/venueQuotation.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// POST /api/vendor-os/enquiries/[id]/quotation/link — a fresh couple's link for the sent quotation; the previous one stops working.
// Answers with linkPath, shown this once. Venue-scoped.
async function handlePOST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = (await getSession())?.user?.id ?? null;
    return NextResponse.json({ success: true, data: await venueQuotationService.newLink((await params).id, actor) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST);
