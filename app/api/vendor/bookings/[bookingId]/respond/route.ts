import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { venuePortalService } from '@/services/venuePortal.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/vendor/bookings/[bookingId]/respond — the vendor answers Shaadi Shopping's booking request: { answer: 'CONFIRM' } or
// { answer: 'DECLINE', reason }. The vendor's own booking only (venuePortalService.respond); the rules are lib/vendor/bookingResponse.ts.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const session = await requireRole([Role.VENDOR]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as { answer?: unknown; reason?: unknown };
    return NextResponse.json({ success: true, data: await venuePortalService.respond(session.user.id, (await params).bookingId, { answer: body.answer, reason: body.reason }) });
  } catch (error) {
    return handleApiError(error);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts) — the booking is on Shaadi Shopping's wedding.
export const POST = platformScoped(handlePOST);
