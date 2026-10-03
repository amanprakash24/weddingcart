import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { reviewService } from '@/services/review.service';

// PATCH /api/weddings/[id]/reviews/[reviewId] — { status: 'PUBLISHED' | 'HIDDEN' }. Publish puts it on the vendor's public page; Hide
// takes it off (the review is kept). Staff only.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; reviewId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const { id, reviewId } = await params;
    return NextResponse.json({ success: true, data: await reviewService.moderate(id, reviewId, body?.status, session.user.id ?? null) });
  } catch (err) {
    return handleApiError(err);
  }
}
