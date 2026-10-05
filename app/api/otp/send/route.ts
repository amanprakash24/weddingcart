import { NextRequest, NextResponse } from 'next/server';
import { otpService } from '@/services/otp.service';
import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import { platformScoped } from '@/lib/ownership/entry';

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

    const phoneId    = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token      = process.env.WHATSAPP_ACCESS_TOKEN;
    // Meta only delivers free-form text inside a 24h customer-service window, which a first-time
    // OTP user never has — so the code is sent through an approved AUTHENTICATION template
    // (copy-code button). Name/language must match the template approved in WhatsApp Manager.
    const template   = process.env.WHATSAPP_OTP_TEMPLATE;
    const language   = process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE || 'en_US';

    if (phoneId && token && template) {
      const res = await fetch(
        `https://graph.facebook.com/v22.0/${phoneId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: `91${phone}`,           // India country code
            type: 'template',
            template: {
              name: template,
              language: { code: language },
              // Authentication templates take the code twice: the body text and the copy-code button.
              components: [
                { type: 'body', parameters: [{ type: 'text', text: code }] },
                { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
              ],
            },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        console.error('[WhatsApp OTP error]', JSON.stringify(err));
        return NextResponse.json(
          { success: false, message: err?.error?.message || 'Failed to send WhatsApp message' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    } else if (process.env.NODE_ENV !== 'production') {
      // Dev mode — WhatsApp not configured, return code in response for testing
      console.log(`\n[OTP DEV] ─────────────────────────────`);
      console.log(`  WhatsApp : +91 ${phone}`);
      console.log(`  Code     : ${code}`);
      console.log(`────────────────────────────────────────\n`);
      return NextResponse.json({ success: true, devCode: code });
    } else {
      // Production with WhatsApp unconfigured/misconfigured — never expose
      // the OTP. Fail with a safe error instead.
      console.error('[OTP send] WhatsApp is not configured in production');
      return NextResponse.json(
        { success: false, message: 'Unable to send OTP right now. Please try again later.' },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('[OTP send]', err);
    return NextResponse.json({ success: false, message: 'Failed to send OTP' }, { status: 500 });
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
