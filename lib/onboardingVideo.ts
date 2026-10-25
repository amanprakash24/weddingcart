import { randomUUID } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import {
  ONBOARDING_UPLOAD_FOLDER,
  ONBOARDING_VIDEO_FORMATS,
  ONBOARDING_VIDEO_LIMITS,
  ONBOARDING_VIDEO_TAGS,
  isOnboardingVideo,
  onboardingPublicId,
} from '@/lib/onboardingUpload';

// The tour video on the public vendor registration form (25 Oct 2026). Server only.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const cloudName = () => process.env.CLOUDINARY_CLOUD_NAME ?? '';

// A signature for ONE video upload. Everything about where it is stored is fixed here: the folder, a random file name, and
// overwrite off — so the signature cannot be reused to put more files in our storage (a second upload with the same name is
// refused by Cloudinary). The size and length are checked once the form is sent (checkOnboardingVideo).
export function onboardingVideoSignature() {
  const params = {
    timestamp: Math.round(Date.now() / 1000),
    folder: ONBOARDING_UPLOAD_FOLDER,
    public_id: `tour-${randomUUID()}`,
    overwrite: 'false',
    tags: ONBOARDING_VIDEO_TAGS.join(','),
    allowed_formats: ONBOARDING_VIDEO_FORMATS.join(','),
  };
  return {
    params,
    signature: cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET as string),
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: cloudName(),
    maxBytes: ONBOARDING_VIDEO_LIMITS.bytes,
    maxSeconds: ONBOARDING_VIDEO_LIMITS.seconds,
  };
}

// What the form says it uploaded → ok, or the sentence to show. Asks Cloudinary what actually landed; one over the limit is deleted.
export async function checkOnboardingVideo(url: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const bad = { ok: false as const, error: 'The tour video did not upload properly. Please upload it again.' };
  if (!isOnboardingVideo(url, cloudName())) return bad;
  const publicId = onboardingPublicId(url);
  if (!publicId) return bad;
  let info: { bytes?: number; duration?: number };
  try {
    info = await cloudinary.api.resource(publicId, { resource_type: 'video' });
  } catch {
    return bad;
  }
  const tooBig = (info.bytes ?? 0) > ONBOARDING_VIDEO_LIMITS.bytes;
  const tooLong = (info.duration ?? 0) > ONBOARDING_VIDEO_LIMITS.seconds + 1; // a second of grace for container rounding
  if (tooBig || tooLong) {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'video' }).catch(() => undefined);
    return { ok: false, error: `The tour video must be up to ${ONBOARDING_VIDEO_LIMITS.seconds} seconds and ${ONBOARDING_VIDEO_LIMITS.bytes / (1024 * 1024)} MB.` };
  }
  return { ok: true };
}
