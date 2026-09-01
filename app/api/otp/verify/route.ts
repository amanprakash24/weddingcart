import { NextResponse } from 'next/server';
import { otpService } from '@/services/otp.service';
import { isRateLimited, recordLoginAttempt } from '@/lib/auth/rateLimit';

export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return NextResponse.json({ success: false, message: 'Phone and code are required' }, { status: 400 });
    }

    // Same lockout as the NextAuth OTP provider (lib/auth/auth.ts) — a 6-digit
    // code is brute-forceable (1M combinations) without this. Checked before
    // verifying so a locked-out phone doesn't leak whether the code was right.
    if (await isRateLimited(phone)) {
      return NextResponse.json(
        { success: false, message: 'Too many attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const valid = await otpService.verifyCode(phone, code);
    await recordLoginAttempt(phone, valid);

    if (!valid) {
      return NextResponse.json({ success: false, message: 'Invalid or expired OTP. Please try again.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[OTP verify]', err);
    return NextResponse.json({ success: false, message: 'Verification failed' }, { status: 500 });
  }
}
