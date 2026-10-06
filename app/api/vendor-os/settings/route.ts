import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueSettingsService } from '@/services/venueSettings.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET /api/vendor-os/settings — the venue's own business settings.
// PUT /api/vendor-os/settings — { contactPhone?, confirmationPercent?, holdWindowDays? }; blank = use the default. Owner only.
// Venue-scoped (lib/ownership/venueEntry.ts): always the logged-in venue's own business, never one named by the request.
async function handleGET() {
  try {
    return NextResponse.json({ success: true, data: await venueSettingsService.get() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await venueSettingsService.update(body ?? {});
    if ('forbidden' in result) return NextResponse.json({ success: false, error: 'Only the owner can change these settings' }, { status: 403 });
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET);
export const PUT = venueScoped(handlePUT);
