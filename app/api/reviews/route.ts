import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import { clientIp } from '@/lib/quotation/proposalHttp';
import { platformScoped } from '@/lib/ownership/entry';
import { isBot, REVIEW_SUBMIT_LIMIT } from '@/lib/reviews/platformReview';
import { platformReviewService } from '@/services/platformReview.service';

// POST /api/reviews — a review of Shaadi Shopping from the public /review page (24 Nov 2026). Public and rate-limited; the review is
// PENDING until staff publish it. A bot that fills the hidden field gets the same "thank you" and nothing is saved.
async function handlePOST(req: NextRequest) {
  try {
    const key = `platform-review:${clientIp(req)}`;
    if (await isRequestRateLimited(key, REVIEW_SUBMIT_LIMIT)) {
      return NextResponse.json({ success: false, error: 'Too many reviews from here — please try again later' }, { status: 429 });
    }
    await recordRequest(key);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ success: false, error: 'Please fill in the form' }, { status: 400 });
    if (isBot(body)) return NextResponse.json({ success: true }, { status: 201 });
    await platformReviewService.submit(body);
    return NextResponse.json({ success: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
