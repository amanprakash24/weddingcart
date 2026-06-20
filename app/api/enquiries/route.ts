import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import EnquiryModel from '@/lib/models/Enquiry';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const query = status ? { status } : {};
    const enquiries = await EnquiryModel.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: enquiries });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch enquiries' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { vendorId, vendorName, vendorCategory, name, phone, email, city, eventDate, guestCount, eventType, message } = body;
    const enquiry = await EnquiryModel.create({
      vendorId, vendorName, vendorCategory,
      name, phone, email, city, eventDate, guestCount, eventType, message,
    });
    return NextResponse.json({ success: true, data: enquiry }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to submit enquiry' }, { status: 500 });
  }
}
