import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueOfferingService } from '@/services/venueOffering.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// PUT    /api/vendor-os/offerings/[id] — change one: { function, name, price, perPlate? }.
// DELETE /api/vendor-os/offerings/[id] — remove one. Quotations already written keep their own lines.
// Both answer with the whole list. Venue-scoped: another business's offering is simply not found.
async function handlePUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await venueOfferingService.update((await params).id, body ?? {});
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json({ success: true, data: await venueOfferingService.remove((await params).id) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const PUT = venueScoped(handlePUT, 'catalog');
export const DELETE = venueScoped(handleDELETE, 'catalog');
