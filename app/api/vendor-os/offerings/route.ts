import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueOfferingService } from '@/services/venueOffering.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET  /api/vendor-os/offerings — what the venue offers for each wedding function, with its starting prices.
// POST /api/vendor-os/offerings — add one: { function, name, price, perPlate? }. Answers with the whole list.
// Venue-scoped (lib/ownership/venueEntry.ts): always the logged-in venue's own list.
async function handleGET() {
  try {
    return NextResponse.json({ success: true, data: await venueOfferingService.list() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await venueOfferingService.create(body ?? {});
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, ['catalog', 'quotations']);
export const POST = venueScoped(handlePOST, 'catalog');
