import { NextRequest } from 'next/server';
import { venueScoped } from '@/lib/ownership/venueEntry';
import { isOwnUpload, PROFILE_UPLOAD_FOLDER } from '@/lib/venue/profile';
import { profileRoute } from '@/lib/venue/profileHttp';
import { checkProfileVideo, cloudinaryCloudName, discardProfileUpload } from '@/lib/venue/profileUpload';
import { venueProfileService } from '@/services/venueProfile.service';

// PUT    /api/vendor-os/profile/video — { url }: the address of a video just uploaded with the signature, or a YouTube / Instagram
//        link. An uploaded video is measured first; over 60 seconds or 50 MB it is deleted and refused.
// DELETE /api/vendor-os/profile/video — remove the video (and take it off the public listing if it had been approved onto it).
// Owner only.
async function handlePUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return profileRoute(async () => {
    const before = await venueProfileService.get();
    if (!before.canEdit) return { forbidden: true };
    if (isOwnUpload(body?.url, cloudinaryCloudName(), PROFILE_UPLOAD_FOLDER)) await checkProfileVideo(body.url);
    const result = await venueProfileService.setVideo(body?.url);
    // A replaced upload is deleted from storage.
    if ('photos' in result && before.video && before.video.url !== result.video?.url) await discardProfileUpload(before.video.url, 'video');
    return result;
  });
}

const handleDELETE = () =>
  profileRoute(async () => {
    const was = (await venueProfileService.get()).video?.url;
    const result = await venueProfileService.removeVideo();
    if ('photos' in result) await discardProfileUpload(was, 'video');
    return result;
  });

export const PUT = venueScoped(handlePUT, 'settings');
export const DELETE = venueScoped(handleDELETE, 'settings');
