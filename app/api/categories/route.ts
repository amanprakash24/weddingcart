import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import CategoryModel from '@/lib/models/Category';
import VendorModel from '@/lib/models/Vendor';

export async function GET() {
  try {
    await connectDB();
    const categories = await CategoryModel.find().sort({ name: 1 }).lean();

    // Sync vendor counts
    const vendorCounts = await VendorModel.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(vendorCounts.map((v) => [v._id, v.count]));

    const enriched = categories.map((c) => ({
      ...c,
      vendorCount: countMap[c.id] ?? c.vendorCount,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const category = await CategoryModel.create(body);
    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
