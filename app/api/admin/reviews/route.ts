import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { platformReviewService } from '@/services/platformReview.service';

// GET /api/admin/reviews[?status=PENDING|PUBLISHED|HIDDEN] — staff: reviews of Shaadi Shopping, with the mobile / wedding ID to check them.
async function handleGET(req: NextRequest) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const s = req.nextUrl.searchParams.get('status');
    const status = s === 'PENDING' || s === 'PUBLISHED' || s === 'HIDDEN' ? s : undefined;
    return NextResponse.json({ success: true, data: await platformReviewService.forAdmin(status) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = platformScoped(handleGET);
