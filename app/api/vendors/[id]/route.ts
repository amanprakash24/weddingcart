import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import VendorModel from '@/lib/models/Vendor';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { id } = await params;
    const vendor = await VendorModel.findOne({ id }).lean();
    if (!vendor) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: vendor });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch vendor' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const vendor = await VendorModel.findOneAndUpdate({ id }, body, { new: true });
    if (!vendor) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: vendor });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update vendor' }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await connectDB();
    const { id } = await params;
    await VendorModel.findOneAndDelete({ id });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete vendor' }, { status: 500 });
  }
}
