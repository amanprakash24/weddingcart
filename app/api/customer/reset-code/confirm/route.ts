import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { coupleCodeResetService } from '@/services/coupleCodeReset.service';

// POST /api/customer/reset-code/confirm — { mobile, otp, next, confirm }: "Forgot your code?" step 2 — the WhatsApp code and the
// couple's new 6-digit login code (services/coupleCodeReset.service.ts). Public; 5 wrong WhatsApp codes lock the number for 15
// minutes. The page then signs in with the new code.
const noStore = { 'Cache-Control': 'no-store' };

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await coupleCodeResetService.confirm({ mobile: body?.mobile, otp: body?.otp, next: body?.next, confirm: body?.confirm });
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400, headers: noStore });
    return NextResponse.json({ success: true }, { headers: noStore });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts); it touches only the couple's own login.
export const POST = platformScoped(handlePOST);
