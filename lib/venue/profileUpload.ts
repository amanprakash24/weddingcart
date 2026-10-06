import { v2 as cloudinary } from 'cloudinary';
import { ValidationError } from '@/lib/errors';
import { ONBOARDING_ALLOWED_FORMATS, validateOnboardingImage } from '@/lib/onboardingUpload';
import { isOwnUpload, PROFILE_LIMITS, PROFILE_UPLOAD_FOLDER } from '@/lib/venue/profile';

// Storing a business's profile media (6 Oct 2026). Server only. "Keep items so that we do not get too much load": every image is
// checked by its own bytes (JPEG / PNG / WebP, under 4 MB) and stored SCALED DOWN — a 12-megapixel phone photo becomes a 1600px
// one — and a video is measured after it lands and thrown away if it is over the limit. The folder and the file name are chosen
// here; nothing about where a file is stored comes from the request.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const TAGS = ['vendor-profile'];

// Our Cloudinary cloud — what isOwnUpload() checks an address against.
export const cloudinaryCloudName = () => process.env.CLOUDINARY_CLOUD_NAME ?? '';

// One image from a multipart request → its stored https address. Throws ValidationError with the sentence to show.
export async function storeProfileImage(file: FormDataEntryValue | null, kind: 'logo' | 'photo'): Promise<string> {
  if (!(file instanceof File)) throw new ValidationError('Choose a photo to upload');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateOnboardingImage(file.type, bytes);
  if (!check.ok) throw new ValidationError(check.error);

  const edge = kind === 'logo' ? PROFILE_LIMITS.logoMaxEdge : PROFILE_LIMITS.imageMaxEdge;
  const result = await new Promise<{ secure_url?: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: PROFILE_UPLOAD_FOLDER,
          resource_type: 'image',
          allowed_formats: ONBOARDING_ALLOWED_FORMATS,
          tags: [...TAGS, kind],
          use_filename: false,
          unique_filename: true,
          overwrite: false,
          // Applied before storing: only the scaled-down image is kept.
          transformation: [{ width: edge, height: edge, crop: 'limit', quality: 'auto:good' }],
        },
        (error, res) => (error || !res ? reject(error ?? new Error('Empty Cloudinary response')) : resolve(res as { secure_url?: string }))
      )
      .end(Buffer.from(bytes));
  });
  if (!result.secure_url?.startsWith('https://')) throw new Error('Cloudinary returned no https URL');
  return result.secure_url;
}

// A video is too big to pass through our own route (Vercel caps a request at 4.5 MB), so the browser sends it straight to
// Cloudinary with this short-lived signature. The signature fixes the folder; the size is checked afterwards (checkProfileVideo).
export function profileVideoSignature() {
  const timestamp = Math.round(Date.now() / 1000);
  const params = { timestamp, folder: PROFILE_UPLOAD_FOLDER, tags: [...TAGS, 'video'].join(',') };
  return {
    ...params,
    signature: cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET as string),
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    maxBytes: PROFILE_LIMITS.videoBytes,
    maxSeconds: PROFILE_LIMITS.videoSeconds,
  };
}

// The stored id of one of our own uploads, from its address: …/video/upload/v123/shaadishopping/vendor-profile/abc.mp4 → shaadishopping/vendor-profile/abc
export function publicIdOf(url: string): string | null {
  const at = url.indexOf(`/${PROFILE_UPLOAD_FOLDER}/`);
  if (at < 0) return null;
  return url.slice(at + 1).replace(/\.[A-Za-z0-9]+$/, '');
}

// After a direct upload: ask Cloudinary what actually landed. Over the limit → it is deleted and the vendor is told why.
export async function checkProfileVideo(url: string): Promise<void> {
  const publicId = publicIdOf(url);
  if (!publicId) throw new ValidationError('That video did not upload properly — please try again');
  let info: { bytes?: number; duration?: number };
  try {
    info = await cloudinary.api.resource(publicId, { resource_type: 'video', media_metadata: true });
  } catch {
    throw new ValidationError('That video did not upload properly — please try again');
  }
  const tooBig = (info.bytes ?? 0) > PROFILE_LIMITS.videoBytes;
  const tooLong = (info.duration ?? 0) > PROFILE_LIMITS.videoSeconds + 1; // a second of grace for container rounding
  if (tooBig || tooLong) {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'video' }).catch(() => undefined);
    throw new ValidationError(`Please upload a video of up to ${PROFILE_LIMITS.videoSeconds} seconds and ${PROFILE_LIMITS.videoBytes / (1024 * 1024)} MB — or paste a YouTube or Instagram link instead`);
  }
}

// When a business removes or replaces a photo, logo or video, the stored file goes too — nothing is left behind to pay for.
// Best effort: the profile change has already been saved, so a storage hiccup here is logged, never shown to the vendor.
// Only one of our own uploads is ever deleted (isOwnUpload); a link or any other address is left alone.
export async function discardProfileUpload(url: string | null | undefined, kind: 'image' | 'video'): Promise<void> {
  if (!isOwnUpload(url, cloudinaryCloudName(), PROFILE_UPLOAD_FOLDER)) return;
  const publicId = publicIdOf(url);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: kind, invalidate: true });
  } catch (err) {
    console.error('profile upload could not be deleted from storage:', publicId, err instanceof Error ? err.message : err);
  }
}
