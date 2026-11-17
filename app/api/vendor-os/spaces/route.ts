import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueSpaceService } from '@/services/venueSpace.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET  /api/vendor-os/spaces — the business's halls and lawns: { usesHalls, spaces }.
// POST /api/vendor-os/spaces — add one: { name, capacity? }. Answers with the whole list. Venue-scoped (lib/ownership/venueEntry.ts).
async function handleGET() {
  try {
    return NextResponse.json({ success: true, data: await venueSpaceService.list() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await venueSpaceService.add(body ?? {});
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, ['enquiries', 'quotations', 'weddings', 'settings']);
export const POST = venueScoped(handlePOST, 'settings');
