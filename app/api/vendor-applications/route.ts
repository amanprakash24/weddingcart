import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import VendorApplicationModel from '@/lib/models/VendorApplication';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const filter = status && status !== 'all' ? { status } : {};
    const applications = await VendorApplicationModel.find(filter).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: applications });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch applications' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();

    // Whitelist fields — prevent injecting status or vendorId
    const {
      businessName, ownerName, ownerPhone, ownerEmail,
      category, city, priceMin, priceMax,
      experience, description, instagram, website,
      coverImage, portfolioImages, foodMenuImages,
    } = body;

    const application = await VendorApplicationModel.create({
      businessName, ownerName, ownerPhone, ownerEmail,
      category, city, priceMin, priceMax,
      experience, description, instagram, website,
      coverImage, portfolioImages, foodMenuImages,
    });
    return NextResponse.json({ success: true, data: application }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to submit application' }, { status: 500 });
  }
}
