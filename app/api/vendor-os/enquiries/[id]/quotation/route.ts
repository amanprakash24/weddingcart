import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { venueQuotationService } from '@/services/venueQuotation.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET /api/vendor-os/enquiries/[id]/quotation — the venue's own quotation for this enquiry (or none yet), with what the form needs.
// PUT /api/vendor-os/enquiries/[id]/quotation — save the draft: { items: [{ description, quantity, unitPrice }], discount?, validUntil,
//     inclusions?, exclusions?, terms? }. No totals are accepted; the amount that confirms the booking is the venue's own rule.
// Venue-scoped (lib/ownership/venueEntry.ts): another business's enquiry is simply not found.
async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json({ success: true, data: await venueQuotationService.get((await params).id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await venueQuotationService.save((await params).id, body ?? {}, (await getSession())?.user?.id ?? null);
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET);
export const PUT = venueScoped(handlePUT);
