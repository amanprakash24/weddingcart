import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueScoped } from '@/lib/ownership/venueEntry';
import { PROFILE_LIMITS } from '@/lib/venue/profile';
import { profileAnswer, uploadsPaused } from '@/lib/venue/profileHttp';
import { storeProfileImage } from '@/lib/venue/profileUpload';
import { venueProfileService } from '@/services/venueProfile.service';

// POST /api/vendor-os/profile/photos — multipart, field "file": one JPEG / PNG / WebP under 4 MB. Stored scaled down to 1600px,
// in our own folder, under a name chosen here (lib/venue/profileUpload.ts). Up to 12 photos. Owner only. The photo is usable at
// once on the business's own documents and waits for Shaadi Shopping's approval before it shows on the public listing.
async function handlePOST(req: NextRequest) {
  try {
    const paused = await uploadsPaused();
    if (paused) return paused;
    // Before anything is stored: may this login change the profile, and is there room?
    const now = await venueProfileService.get();
    if (!now.canEdit) return profileAnswer({ forbidden: true });
    if (now.photos.length >= PROFILE_LIMITS.photosMax) {
      return NextResponse.json({ success: false, error: `You can keep up to ${PROFILE_LIMITS.photosMax} photos — remove one to add another` }, { status: 409 });
    }
    const declared = Number(req.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > PROFILE_LIMITS.imageBytes + 64 * 1024) {
      return NextResponse.json({ success: false, error: 'Image must be under 4 MB. Please choose a smaller photo.' }, { status: 413 });
    }
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ success: false, error: 'Choose a photo to upload' }, { status: 400 });
    return profileAnswer(await venueProfileService.addPhoto(await storeProfileImage(form.get('file'), 'photo')));
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST, 'settings');
