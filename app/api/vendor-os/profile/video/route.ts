import { NextRequest } from 'next/server';
import { venueScoped } from '@/lib/ownership/venueEntry';
import { isOwnUpload, PROFILE_UPLOAD_FOLDER } from '@/lib/venue/profile';
import { profileRoute } from '@/lib/venue/profileHttp';
import { checkProfileVideo, cloudinaryCloudName } from '@/lib/venue/profileUpload';
import { venueProfileService } from '@/services/venueProfile.service';

// PUT    /api/vendor-os/profile/video — { url }: the address of a video just uploaded with the signature, or a YouTube / Instagram
//        link. An uploaded video is measured first; over 60 seconds or 50 MB it is deleted and refused.
// DELETE /api/vendor-os/profile/video — remove the video (and take it off the public listing if it had been approved onto it).
// Owner only.
async function handlePUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return profileRoute(async () => {
    if (!(await venueProfileService.get()).canEdit) return { forbidden: true };
    if (isOwnUpload(body?.url, cloudinaryCloudName(), PROFILE_UPLOAD_FOLDER)) await checkProfileVideo(body.url);
    return venueProfileService.setVideo(body?.url);
  });
}

const handleDELETE = () => profileRoute(() => venueProfileService.removeVideo());

export const PUT = venueScoped(handlePUT);
export const DELETE = venueScoped(handleDELETE);
