import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { REVIEW_PAGE_PATH } from '@/lib/reviews/platformReview';
import { platformReviewService } from '@/services/platformReview.service';
import { readJsonBody } from '@/lib/readJsonBody';

// PATCH /api/admin/reviews/[id] — { status: PUBLISHED | HIDDEN | PENDING }: staff publish a review on /review or hide it (never deleted).
async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { status } = z.object({ status: z.enum(['PUBLISHED', 'HIDDEN', 'PENDING']) }).parse(await readJsonBody(req));
    const updated = await platformReviewService.moderate((await params).id, status, session.user.id ?? null);
    revalidatePath(REVIEW_PAGE_PATH);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export const PATCH = platformScoped(handlePATCH);
