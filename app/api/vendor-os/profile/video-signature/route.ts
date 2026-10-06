import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueScoped } from '@/lib/ownership/venueEntry';
import { profileAnswer, uploadsPaused } from '@/lib/venue/profileHttp';
import { profileVideoSignature } from '@/lib/venue/profileUpload';
import { venueProfileService } from '@/services/venueProfile.service';

// POST /api/vendor-os/profile/video-signature — a short-lived signature so the browser can send ONE video straight to our storage
// (a video is too big to pass through our own route). Owner only. The size and length are checked when the video is saved
// (PUT /api/vendor-os/profile/video), and an oversized one is deleted.
async function handlePOST() {
  try {
    const paused = await uploadsPaused();
    if (paused) return paused;
    if (!(await venueProfileService.get()).canEdit) return profileAnswer({ forbidden: true });
    return NextResponse.json({ success: true, ...profileVideoSignature() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST);
