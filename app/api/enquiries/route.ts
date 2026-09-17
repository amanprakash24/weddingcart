import { NextRequest, NextResponse } from 'next/server';
import { enquiryService } from '@/services/enquiry.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import { enquiryCreateSchema } from './schema';
import type { Enquiry, EnquiryStatus } from '@/generated/prisma/client';

// Public, unauthenticated POST — previously had neither validation nor rate
// limiting (production-readiness audit finding), unlike its sibling routes
// (consultations/vendor-applications/events-orders). Same
// isRequestRateLimited/recordRequest pair, same reasoning: a public form
// with no "wrong guess" concept, where the abuse signal is request volume.
const RATE_LIMIT_PREFIX = 'enquiry:';

function clientIp(req: NextRequest): string {
  // Vercel sets x-forwarded-for; first entry is the original client.
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

// Admin UI still expects the legacy Mongo shape: lowercase status
// ('new'/'contacted'/'closed', Prisma's EnquiryStatus enum is uppercase) and
// an `_id` field (Prisma's is `id`). Shaping happens here at the route
// boundary, not in the repository/service.
function toResponseShape(enquiry: Enquiry) {
  return {
    ...enquiry,
    _id: enquiry.id,
    status: enquiry.status.toLowerCase(),
  };
}

function toEnquiryStatus(status: string | null): EnquiryStatus | undefined {
  if (status === 'new') return 'NEW';
  if (status === 'contacted') return 'CONTACTED';
  if (status === 'closed') return 'CLOSED';
  return undefined;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = toEnquiryStatus(searchParams.get('status'));

    const { data } = await enquiryService.list({ status });

    return NextResponse.json({ success: true, data: data.map(toResponseShape) });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch enquiries' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitId = `${RATE_LIMIT_PREFIX}${clientIp(req)}`;
    if (await isRequestRateLimited(rateLimitId)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }
    await recordRequest(rateLimitId);

    const data = enquiryCreateSchema.parse(await req.json());
    const enquiry = await enquiryService.create(data);

    return NextResponse.json({ success: true, data: toResponseShape(enquiry) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
