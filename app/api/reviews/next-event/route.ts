import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import { clientIp } from '@/lib/quotation/proposalHttp';
import { platformScoped } from '@/lib/ownership/entry';
import { nextEventIsBot } from '@/lib/reviews/nextEvent';
import { REVIEW_SUBMIT_LIMIT } from '@/lib/reviews/platformReview';
import { reviewFollowUpService } from '@/services/platformReview.service';

// POST /api/reviews/next-event — from /review: "our next celebration" or "refer family & friends" (24 Nov 2026). Public and
// rate-limited; it becomes a consultation in Shaadi Shopping's CRM. A bot that fills the hidden field is thanked and nothing is saved.
async function handlePOST(req: NextRequest) {
  try {
    const key = `review-next-event:${clientIp(req)}`;
    if (await isRequestRateLimited(key, REVIEW_SUBMIT_LIMIT)) {
      return NextResponse.json({ success: false, error: 'Too many requests from here — please call us instead' }, { status: 429 });
    }
    await recordRequest(key);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ success: false, error: 'Please fill in the form' }, { status: 400 });
    if (nextEventIsBot(body)) return NextResponse.json({ success: true }, { status: 201 });
    await reviewFollowUpService.submit(body);
    return NextResponse.json({ success: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: works as Shaadi Shopping (lib/ownership/entry.ts) — the consultation is Shaadi Shopping's.
export const POST = platformScoped(handlePOST);
