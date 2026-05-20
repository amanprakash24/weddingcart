import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import OTP from '@/lib/models/OTP';

export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return NextResponse.json({ success: false, message: 'Phone and code are required' }, { status: 400 });
    }

    await connectDB();

    const record = await OTP.findOne({ phone, code });

    if (!record) {
      return NextResponse.json({ success: false, message: 'Invalid or expired OTP. Please try again.' }, { status: 400 });
    }

    await OTP.deleteOne({ _id: record._id });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[OTP verify]', err);
    return NextResponse.json({ success: false, message: 'Verification failed' }, { status: 500 });
  }
}
