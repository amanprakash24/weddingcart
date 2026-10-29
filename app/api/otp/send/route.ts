import { NextRequest, NextResponse } from 'next/server';
import { otpService } from '@/services/otp.service';
import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import { platformScoped } from '@/lib/ownership/entry';
import { sendWhatsAppCode } from '@/lib/whatsappOtp';

// Production-readiness audit (2026-09-17) — public, unauthenticated, and the
// only trigger for a real, billable WhatsApp Business API send. The existing
// 60s-per-phone cooldown (otpService.requestCode) stops one phone from being
// hammered, but does nothing to stop one IP from iterating across many
// different phone numbers — unlimited free WhatsApp sends to arbitrary
// numbers. Same "spammable external-cost action" class app/api/consultations
// /route.ts, app/api/vendor-applications/route.ts, and
// app/api/events/[id]/orders/route.ts already guard against; reuses the
// identical isRequestRateLimited/recordRequest pair rather than inventing a
// second mechanism. Namespaced so these throttle records stay distinguishable
// from real login/OTP identifiers (phone numbers) sharing the same table.
const RATE_LIMIT_PREFIX = 'otp-send:';

function clientIp(req: NextRequest): string {
  // Vercel sets x-forwarded-for; first entry is the original client.
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

async function handlePOST(req: NextRequest) {
  try {
    const rateLimitId = `${RATE_LIMIT_PREFIX}${clientIp(req)}`;
    if (await isRequestRateLimited(rateLimitId)) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }
    await recordRequest(rateLimitId);

    const { phone } = await req.json();

    if (!phone || !/^\d{10}$/.test(phone)) {
      return NextResponse.json({ success: false, message: 'Invalid phone number' }, { status: 400 });
    }

    const result = await otpService.requestCode(phone);
    if ('waitSeconds' in result) {
      return NextResponse.json(
        { success: false, message: `Please wait ${result.waitSeconds} seconds before requesting another OTP` },
        { status: 429 },
      );
    }
    const { code } = result;
    // The WhatsApp send itself (template, dev-mode code, production safety) lives in lib/whatsappOtp.ts — shared with the couple's code reset.
    const sent = await sendWhatsAppCode(phone, code);
    if (!sent.ok) return NextResponse.json({ success: false, message: sent.message }, { status: sent.status });
    return NextResponse.json(sent.devCode ? { success: true, devCode: sent.devCode } : { success: true });
  } catch (err) {
    console.error('[OTP send]', err);
    return NextResponse.json({ success: false, message: 'Failed to send OTP' }, { status: 500 });
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
