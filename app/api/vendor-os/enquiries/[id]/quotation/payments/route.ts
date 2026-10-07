import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { venueQuotationService } from '@/services/venueQuotation.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// POST /api/vendor-os/enquiries/[id]/quotation/payments — money the venue received from its own customer for the accepted quotation:
//     { amount, method: CASH | UPI | BANK_TRANSFER | CHEQUE, reference?, paidOn? (YYYY-MM-DD), idempotencyKey? }.
// A part payment holds the date; once the amount to confirm is in, the booking is confirmed. Nothing is charged and no payment
// provider is called. Venue-scoped (lib/ownership/venueEntry.ts): another business's enquiry is simply not found.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await venueQuotationService.pay((await params).id, body ?? {}, (await getSession())?.user?.id ?? null);
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: result }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST, 'edit_financials');
