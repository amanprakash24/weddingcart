import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueOfferingService } from '@/services/venueOffering.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// PUT    /api/vendor-os/offerings/[id] — change one: { kind, name, price, description?, function?, perPlate?, active? }.
// PATCH  /api/vendor-os/offerings/[id] — { active } only: offer it, or keep it in the list but stop offering it.
// DELETE /api/vendor-os/offerings/[id] — remove one. Quotations already written keep their own lines.
// All answer with the whole catalog. Venue-scoped: another business's item is simply not found.
type Ctx = { params: Promise<{ id: string }> };

async function handlePUT(req: NextRequest, { params }: Ctx) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await venueOfferingService.update((await params).id, body ?? {});
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: await venueOfferingService.catalog() });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePATCH(req: NextRequest, { params }: Ctx) {
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.active !== 'boolean') return NextResponse.json({ success: false, error: 'Say whether to offer it or not' }, { status: 400 });
    await venueOfferingService.setActive((await params).id, body.active);
    return NextResponse.json({ success: true, data: await venueOfferingService.catalog() });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handleDELETE(_req: NextRequest, { params }: Ctx) {
  try {
    await venueOfferingService.remove((await params).id);
    return NextResponse.json({ success: true, data: await venueOfferingService.catalog() });
  } catch (err) {
    return handleApiError(err);
  }
}

export const PUT = venueScoped(handlePUT, 'catalog');
export const PATCH = venueScoped(handlePATCH, 'catalog');
export const DELETE = venueScoped(handleDELETE, 'catalog');
