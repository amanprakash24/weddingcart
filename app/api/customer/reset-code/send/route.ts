import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import { platformScoped } from '@/lib/ownership/entry';
import { coupleCodeResetService } from '@/services/coupleCodeReset.service';

// POST /api/customer/reset-code/send — { mobile }: "Forgot your code?" step 1 — a one-time code on WhatsApp
// (services/coupleCodeReset.service.ts). Public. Same answer whether or not the number has a sign-in. Throttled per IP like
// /api/otp/send, since a WhatsApp message costs money.
const noStore = { 'Cache-Control': 'no-store' };
const clientIp = (req: NextRequest) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

async function handlePOST(req: NextRequest) {
  try {
    const throttle = `couple-reset-send:${clientIp(req)}`;
    if (await isRequestRateLimited(throttle)) return NextResponse.json({ success: false, error: 'Too many requests. Please try again later.' }, { status: 429, headers: noStore });
    await recordRequest(throttle);
    const body = await req.json().catch(() => ({}));
    const result = await coupleCodeResetService.send(body?.mobile);
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400, headers: noStore });
    return NextResponse.json({ success: true, ...(result.devCode ? { devCode: result.devCode } : {}) }, { headers: noStore });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts); it touches only the couple's own login.
export const POST = platformScoped(handlePOST);
