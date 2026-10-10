import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { venueQuotationService } from '@/services/venueQuotation.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// POST /api/vendor-os/enquiries/[id]/quotation/claims/[claimId] — the couple said "I have paid" on their link, and the business has
// looked in its own account:   { received: true }   the money is there — the payment is recorded (safe to press twice);
//                               { received: false, reason }   it is not — the couple reads the reason on their link.
// Venue-scoped (lib/ownership/venueEntry.ts): another business's enquiry or claim is simply not found.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; claimId: string }> }) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, claimId } = await params;
    const result = await venueQuotationService.checkClaim(id, claimId, body ?? {}, (await getSession())?.user?.id ?? null);
    return NextResponse.json({ success: true, data: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST, 'edit_financials');
