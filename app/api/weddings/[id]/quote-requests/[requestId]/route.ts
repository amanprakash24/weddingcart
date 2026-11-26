import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { quoteAnswerBody } from '@/lib/wedding/coupleVendorSchema';
import { coupleVendorsService } from '@/services/coupleVendors.service';
import { readJsonBody } from '@/lib/readJsonBody';

// PATCH /api/weddings/[id]/quote-requests/[requestId]: Shaadi Shopping answers a couple's quote request (price shared / not available /
// booked / closed). Booking the vendor itself is done the normal way ("Add service" → a VendorBooking).
async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = quoteAnswerBody.parse(await readJsonBody(req));
    const { id, requestId } = await params;
    return NextResponse.json({ success: true, data: await coupleVendorsService.answer(id, requestId, body, session.user.id ?? null) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const PATCH = platformScoped(handlePATCH);
