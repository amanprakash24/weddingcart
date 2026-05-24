import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { phone, whatsapp } = await req.json();
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ success: false, error: 'Valid phone number required' }, { status: 400 });
    }
    await Lead.create({ phone, whatsapp: !!whatsapp });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
