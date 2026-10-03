import type { NextRequest } from 'next/server';
import { proposalService } from '@/services/proposal.service';
import { proposalError, proposalJson, proposalRateLimited } from '@/lib/quotation/proposalHttp';

// POST /api/proposal/[token]/reviews — the couple reviews one vendor they booked (Roadmap 1.4, 08-quotation.md §19). Public; the
// secret token is the only key. Body: { bookingId, rating 1–5, comment?, authorName }. Only once the wedding is completed; the review
// is PENDING until staff publish it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (await proposalRateLimited(req)) return proposalJson({ success: false, error: 'Too many attempts — please try again later' }, 429);
  try {
    const body = await req.json().catch(() => null);
    const result = await proposalService.submitReview((await params).token, body?.bookingId, { rating: body?.rating, comment: body?.comment, authorName: body?.authorName });
    return proposalJson({ success: true, data: { reviews: result.reviews } }, 201);
  } catch (err) {
    return proposalError(err);
  }
}
