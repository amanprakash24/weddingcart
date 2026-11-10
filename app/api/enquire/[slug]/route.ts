import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import { clientIp } from '@/lib/quotation/proposalHttp';
import { enquiryPageService } from '@/services/enquiryPage.service';
import { enquiryPageScoped } from '@/lib/venue/enquiryPageEntry';

// POST /api/enquire/[slug] — the couple sends the venue's public enquiry form (11 Nov 2026, Vivah OS phase 1):
// { name, phone, eventType, weddingDate?, days?, functions?, guestCount?, budget?, need?, src?, trap, openMs }.
// Runs as the venue the address belongs to (lib/venue/enquiryPageEntry.ts); services/enquiryPage.service.ts has the rules.
// Public: a few forms per connection per 15 minutes; never cached, never indexed.
const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } as const;
const ENQUIRY_PAGE_LIMIT = { max: 5, windowMinutes: 15 } as const;

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const limitId = `enquiry-page:${clientIp(req)}`;
    if (await isRequestRateLimited(limitId, ENQUIRY_PAGE_LIMIT)) {
      return NextResponse.json({ success: false, error: 'Too many enquiries from this connection. Please try again in 15 minutes.' }, { status: 429, headers: HEADERS });
    }
    await recordRequest(limitId);
    const body = await req.json().catch(() => ({}));
    const result = await enquiryPageService.receive((await params).slug, body && typeof body === 'object' ? body : {});
    if (!result.ok) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400, headers: HEADERS });
    return NextResponse.json({ success: true, data: { firstName: result.firstName } }, { status: 201, headers: HEADERS });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = enquiryPageScoped(handlePOST);
