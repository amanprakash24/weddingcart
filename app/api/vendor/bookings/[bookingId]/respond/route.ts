import { NextRequest, NextResponse } from 'next/server';
import { sharedRoute } from '@/lib/auth/workingVendor';
import { venuePortalService } from '@/services/venuePortal.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/vendor/bookings/[bookingId]/respond — the vendor answers Shaadi Shopping's booking request: { answer: 'CONFIRM' } or
// { answer: 'DECLINE', reason }. A booking of the vendor the person is working in, by the owner or anyone there who may manage its
// weddings (lib/auth/workingVendor.ts); the rules are lib/vendor/bookingResponse.ts.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const gate = await sharedRoute('weddings');
  if ('refused' in gate) return gate.refused;
  try {
    const body = (await req.json().catch(() => ({}))) as { answer?: unknown; reason?: unknown };
    return NextResponse.json({ success: true, data: await venuePortalService.respond(gate.who, (await params).bookingId, { answer: body.answer, reason: body.reason }) });
  } catch (error) {
    return handleApiError(error);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts) — the booking is on Shaadi Shopping's wedding.
export const POST = platformScoped(handlePOST);
