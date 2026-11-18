import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { venueSpaceService } from '@/services/venueSpace.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET  /api/vendor-os/enquiries/[id]/slots — the halls and shifts this enquiry reserves, each with what else is on that hall then.
// POST /api/vendor-os/enquiries/[id]/slots — reserve one: { spaceId, date: YYYY-MM-DD, shift: DAY | NIGHT | FULL_DAY }. A clash is
// answered as a warning in the list, never refused. Venue-scoped: another business's enquiry is "not found".
type Ctx = { params: Promise<{ id: string }> };

async function handleGET(_req: NextRequest, { params }: Ctx) {
  try {
    return NextResponse.json({ success: true, data: await venueSpaceService.forEnquiry((await params).id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePOST(req: NextRequest, { params }: Ctx) {
  try {
    const body = await req.json().catch(() => ({}));
    const actor = (await getSession())?.user?.id ?? null;
    const result = await venueSpaceService.reserve((await params).id, body ?? {}, actor);
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, ['enquiries', 'quotations']);
export const POST = venueScoped(handlePOST, 'quotations');
