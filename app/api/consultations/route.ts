import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import ConsultationModel from '@/lib/models/Consultation';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const query = status ? { status } : {};
    const consultations = await ConsultationModel.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: consultations });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const consultation = await ConsultationModel.create(body);
    return NextResponse.json({ success: true, data: consultation }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
