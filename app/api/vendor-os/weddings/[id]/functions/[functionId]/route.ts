import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { venueWeddingService } from '@/services/venueWedding.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

type Ctx = { params: Promise<{ id: string; functionId: string }> };

// PATCH /api/vendor-os/weddings/[id]/functions/[functionId] — save a function: { type, label?, date, startTime?, place? } (the whole
//     form). Moving the "Wedding" function moves the wedding's date.
// DELETE — remove a function. Only an empty one, and never the last. Venue-scoped.
async function handlePATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id, functionId } = await params;
    const body = await req.json().catch(() => ({}));
    const result = await venueWeddingService.updateFunction(id, functionId, body ?? {}, (await getSession())?.user?.id ?? null);
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handleDELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id, functionId } = await params;
    return NextResponse.json({ success: true, data: await venueWeddingService.removeFunction(id, functionId, (await getSession())?.user?.id ?? null) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const PATCH = venueScoped(handlePATCH, 'weddings');
export const DELETE = venueScoped(handleDELETE, 'weddings');
