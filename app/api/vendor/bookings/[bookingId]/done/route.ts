import { NextRequest, NextResponse } from 'next/server';
import { sharedRoute } from '@/lib/auth/workingVendor';
import { venuePortalService } from '@/services/venuePortal.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/vendor/bookings/[bookingId]/done — the vendor says the work is done ({ note? }) (money design v1, PR 6). Confirmed work of
// the vendor the person works in, by anyone there who may manage its weddings. Staff then verify it ("Mark completed").
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const gate = await sharedRoute('weddings');
  if ('refused' in gate) return gate.refused;
  try {
    const body = (await req.json().catch(() => ({}))) as { note?: unknown };
    return NextResponse.json({ success: true, data: await venuePortalService.markDone(gate.who, (await params).bookingId, body.note) });
  } catch (error) {
    return handleApiError(error);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
