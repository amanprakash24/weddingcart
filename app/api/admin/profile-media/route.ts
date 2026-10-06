import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { profileReviewService } from '@/services/venueProfile.service';

// GET /api/admin/profile-media — photos and videos vendors uploaded to their profiles that are waiting for a decision. A photo or
// video appears on a vendor's PUBLIC listing only after an admin approves it here.
async function handleGET() {
  if (!(await requireAdmin())) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ success: true, data: await profileReviewService.pending() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
