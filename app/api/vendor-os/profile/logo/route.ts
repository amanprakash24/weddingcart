import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueScoped } from '@/lib/ownership/venueEntry';
import { PROFILE_LIMITS } from '@/lib/venue/profile';
import { profileAnswer, uploadsPaused } from '@/lib/venue/profileHttp';
import { discardProfileUpload, storeProfileImage } from '@/lib/venue/profileUpload';
import { venueProfileService } from '@/services/venueProfile.service';

// POST /api/vendor-os/profile/logo — multipart, field "file": one JPEG / PNG / WebP under 4 MB. Stored scaled down, in our own
// folder, under a name chosen here (lib/venue/profileUpload.ts). Owner only. Answers with the whole profile.
async function handlePOST(req: NextRequest) {
  try {
    const paused = await uploadsPaused();
    if (paused) return paused;
    // Before anything is stored: may this login change the profile?
    const before = await venueProfileService.get();
    if (!before.canEdit) return profileAnswer({ forbidden: true });
    const declared = Number(req.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > PROFILE_LIMITS.imageBytes + 64 * 1024) {
      return NextResponse.json({ success: false, error: 'Image must be under 4 MB. Please choose a smaller one.' }, { status: 413 });
    }
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ success: false, error: 'Choose a logo to upload' }, { status: 400 });
    const result = await venueProfileService.setLogo(await storeProfileImage(form.get('file'), 'logo'));
    // The logo it replaces is deleted from storage.
    if ('photos' in result && before.logoUrl && before.logoUrl !== result.logoUrl) await discardProfileUpload(before.logoUrl, 'image');
    return profileAnswer(result);
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST, 'settings');
