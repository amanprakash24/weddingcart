import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import VendorApplicationModel from '@/lib/models/VendorApplication';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const filter = status && status !== 'all' ? { status } : {};
    const applications = await VendorApplicationModel.find(filter).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: applications });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const application = await VendorApplicationModel.create(body);
    return NextResponse.json({ success: true, data: application }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
