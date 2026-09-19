// Validation + constants for the public vendor-onboarding image upload
// (POST /api/vendor-applications/upload). The generic /api/upload stays
// admin-only; this is the narrow, dedicated path for unauthenticated venues.
//
// Everything security-relevant lives here as pure functions so it is unit
// tested without Cloudinary or a request object:
//  - the file type is decided from the file's own bytes (magic numbers), never
//    from the client-supplied name or Content-Type alone;
//  - the client-declared Content-Type must agree with those bytes;
//  - the storage folder is a server constant — no part of it (or of the file
//    name) comes from the request.

// Every upload lands here, separate from vendors' permanent media, tagged so
// unapproved/abandoned uploads are easy to find and purge later.
export const ONBOARDING_UPLOAD_FOLDER = 'shaadishopping/vendor-onboarding';
export const ONBOARDING_UPLOAD_TAGS = ['vendor-onboarding', 'unverified'];

// Kept under Vercel's 4.5 MB request-body cap for serverless functions, which
// is the real ceiling for a multipart upload through a Route Handler (the old
// 10 MB limit on /api/upload could never be reached in production).
export const MAX_ONBOARDING_IMAGE_BYTES = 4 * 1024 * 1024;

// Cloudinary format names matching the MIME types below.
export const ONBOARDING_ALLOWED_FORMATS = ['jpg', 'png', 'webp'];

export type OnboardingImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

const ALLOWED_MIMES: ReadonlySet<string> = new Set<OnboardingImageMime>(['image/jpeg', 'image/png', 'image/webp']);

// Decide the real image type from the leading bytes. Returns null for anything
// that isn't a JPEG, PNG or WebP (including GIF, SVG, HTML, PDF, executables).
export function detectImageMime(bytes: Uint8Array): OnboardingImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: "RIFF" <4-byte size> "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export type OnboardingImageCheck =
  | { ok: true; mime: OnboardingImageMime }
  | { ok: false; status: 400 | 413 | 415; error: string };

export function validateOnboardingImage(declaredType: string, bytes: Uint8Array): OnboardingImageCheck {
  if (bytes.length === 0) return { ok: false, status: 400, error: 'The file is empty' };
  if (bytes.length > MAX_ONBOARDING_IMAGE_BYTES) {
    return { ok: false, status: 413, error: 'Image must be under 4 MB. Please choose a smaller photo.' };
  }
  if (!ALLOWED_MIMES.has(declaredType)) {
    return { ok: false, status: 415, error: 'Only JPEG, PNG or WebP images are allowed' };
  }
  const detected = detectImageMime(bytes);
  if (!detected || detected !== declaredType) {
    return { ok: false, status: 415, error: 'The file is not a valid JPEG, PNG or WebP image' };
  }
  return { ok: true, mime: detected };
}
