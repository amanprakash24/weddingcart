import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueOfferingService } from '@/services/venueOffering.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET  /api/vendor-os/offerings — the business's price list ("What we offer"): { items, kinds, listingPackages }.
// POST /api/vendor-os/offerings — add one: { kind, name, price, description?, function?, perPlate?, active? }.
// Every answer is the whole catalog. Venue-scoped (lib/ownership/venueEntry.ts): always the logged-in business's own list.
async function handleGET() {
  try {
    return NextResponse.json({ success: true, data: await venueOfferingService.catalog() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await venueOfferingService.create(body ?? {});
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: await venueOfferingService.catalog() }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, ['catalog', 'quotations']);
export const POST = venueScoped(handlePOST, 'catalog');
