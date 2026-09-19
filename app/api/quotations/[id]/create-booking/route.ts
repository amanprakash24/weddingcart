import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { quotationService } from '@/services/quotation.service';
import { createBookingSchema } from '../../schema';

// POST /api/quotations/[id]/create-booking — turn an ACCEPTED quotation into a Booking (status NEW).
// Lines and prices come from the quotation, not from vendor package lists. 409 unless the quotation is
// accepted and has no booking yet; 400 if the wedding date or city is missing and not supplied here.
// Confirming the booking afterwards uses the existing PUT /api/bookings/[id].
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    // An empty body is fine — every field is optional.
    const raw = await req.json().catch(() => ({}));
    const overrides = createBookingSchema.parse(raw ?? {});
    const booking = await quotationService.createBooking((await params).id, overrides, session.user.id ?? null);
    return NextResponse.json(
      {
        success: true,
        data: {
          id: booking.id,
          name: booking.name,
          phone: booking.phone,
          city: booking.city,
          total: booking.total,
          status: booking.status,
          weddingDate: booking.weddingDate,
          guestCount: booking.guestCount,
          quotationId: booking.quotationId,
          itemCount: booking.items.length,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
