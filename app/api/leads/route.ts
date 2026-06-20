import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await connectDB();
    const leads = await Lead.find().sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: leads });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { phone, whatsapp } = await req.json();
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ success: false, error: 'Valid phone number required' }, { status: 400 });
    }
    await Lead.create({ phone, whatsapp: !!whatsapp });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to save lead' }, { status: 500 });
  }
}
