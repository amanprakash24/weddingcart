import { NextRequest, NextResponse } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { requireAdmin } from '@/lib/adminAuth';
import type { Booking } from '@/generated/prisma/client';

// Admin UI still expects the legacy Mongo shape: lowercase status
// ('new'/'contacted'/'confirmed'/'closed', Prisma's BookingStatus enum is
// uppercase) and an `_id` field (Prisma's is `id`). Shaping happens here at
// the route boundary, not in the repository/service.
function toResponseShape<T extends Pick<Booking, 'id' | 'status'>>(booking: T) {
  return { ...booking, _id: booking.id, status: booking.status.toLowerCase() };
}

export async function GET() {
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, city, items, total } = body;

    const booking = await bookingService.create({ name, phone, city, items, total });

    return NextResponse.json({ success: true, data: toResponseShape(booking) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/bookings failed:', err);
    return NextResponse.json({ success: false, error: 'Failed to create booking' }, { status: 500 });
  }
}
