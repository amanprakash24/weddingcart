import { NextResponse } from 'next/server';
import { otpService } from '@/services/otp.service';

export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return NextResponse.json({ success: false, message: 'Phone and code are required' }, { status: 400 });
    }

    const valid = await otpService.verifyCode(phone, code);

    if (!valid) {
      return NextResponse.json({ success: false, message: 'Invalid or expired OTP. Please try again.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[OTP verify]', err);
    return NextResponse.json({ success: false, message: 'Verification failed' }, { status: 500 });
  }
}
