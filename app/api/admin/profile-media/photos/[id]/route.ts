import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { profileReviewService } from '@/services/venueProfile.service';

// POST /api/admin/profile-media/photos/[id] — { approve: true | false }. Approve: the photo joins the vendor's public gallery.
// Reject: it never does; the vendor keeps it for their own documents. A photo already decided is left as it is.
// Answers with what is still waiting.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.approve !== 'boolean') return NextResponse.json({ success: false, error: 'Say whether to approve or reject' }, { status: 400 });
    await profileReviewService.reviewPhoto((await params).id, body.approve);
    return NextResponse.json({ success: true, data: await profileReviewService.pending() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
