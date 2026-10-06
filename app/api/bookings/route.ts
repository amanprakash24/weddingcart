import { NextRequest, NextResponse } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import { bookingCreateSchema } from './schema';
import type { Booking } from '@/generated/prisma/client';
import { platformScoped } from '@/lib/ownership/entry';

// Admin UI still expects the legacy Mongo shape: lowercase status
// ('new'/'contacted'/'confirmed'/'closed', Prisma's BookingStatus enum is
// uppercase) and an `_id` field (Prisma's is `id`). Shaping happens here at
// the route boundary, not in the repository/service.
function toResponseShape<T extends Pick<Booking, 'id' | 'status'>>(booking: T) {
  return { ...booking, _id: booking.id, status: booking.status.toLowerCase() };
}

async function handleGET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { data } = await bookingService.list();
    return NextResponse.json({ success: true, data: data.map(toResponseShape) });
  } catch (err) {
    console.error('GET /api/bookings failed:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch bookings' }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const { name, phone, city, items, total, weddingDate, weddingType, guestCount, enquiryId, consultationId } =
      bookingCreateSchema.parse(await req.json());
    const booking = await bookingService.create({
      name,
      phone,
      city,
      items,
      total,
      weddingDate,
      weddingType,
      guestCount,
      enquiryId,
      consultationId,
    });
    return NextResponse.json({ success: true, data: toResponseShape(booking) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const POST = platformScoped(handlePOST);
