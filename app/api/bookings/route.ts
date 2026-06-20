import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import BookingModel from '@/lib/models/Booking';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await connectDB();
    const bookings = await BookingModel.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: bookings });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch bookings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { name, phone, city, items, total } = body;
    const booking = await BookingModel.create({ name, phone, city, items, total });
    return NextResponse.json({ success: true, data: booking }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create booking' }, { status: 500 });
  }
}
