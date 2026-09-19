import { v2 as cloudinary } from 'cloudinary';
import { NextRequest, NextResponse } from 'next/server';
import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import {
  MAX_ONBOARDING_IMAGE_BYTES,
  ONBOARDING_ALLOWED_FORMATS,
  ONBOARDING_UPLOAD_FOLDER,
  ONBOARDING_UPLOAD_TAGS,
  validateOnboardingImage,
} from '@/lib/onboardingUpload';

// Public, unauthenticated image upload used ONLY by /vendor-onboarding, where a
// prospective venue has no account yet. The generic POST /api/upload stays
// admin-only (commit 4e5a597); this is a separate, deliberately narrow path:
//  - rate-limited per IP (its own namespace + budget),
//  - JPEG/PNG/WebP only, decided from the file's own bytes, <= 4 MB,
//  - stored in a fixed server-chosen Cloudinary folder with a random name — no
//    part of the storage path or file name comes from the request,
//  - returns only the resulting https URL.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const RATE_LIMIT_PREFIX = 'onboarding-upload:';
// An application uploads up to 5 photos (3 work + 2 menu); this leaves room for
// retries and a couple of applications from one shared (mobile-carrier) IP.
const RATE_LIMIT = { max: 20, windowMinutes: 15 };
// multipart framing adds a little on top of the file itself.
const MAX_BODY_BYTES = MAX_ONBOARDING_IMAGE_BYTES + 64 * 1024;

function clientIp(req: NextRequest): string {
  // Vercel sets x-forwarded-for; first entry is the original client.
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

// Browsers always send Origin on cross-site POSTs. If it is present and is not
// this site, refuse — this endpoint is for our own form, not other websites'.
function isCrossOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.get('host');
  } catch {
    return true;
  }
}

function fail(status: number, error: string) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(req: NextRequest) {
  if (isCrossOrigin(req)) return fail(403, 'Forbidden');

  const rateLimitId = `${RATE_LIMIT_PREFIX}${clientIp(req)}`;
  if (await isRequestRateLimited(rateLimitId, RATE_LIMIT)) {
    return fail(429, 'Too many uploads. Please try again in a few minutes.');
  }
  await recordRequest(rateLimitId);

  const declaredLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return fail(413, 'Image must be under 4 MB. Please choose a smaller photo.');
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get('file');
  } catch {
    return fail(400, 'Invalid upload');
  }
  if (!(file instanceof File)) return fail(400, 'No file provided');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateOnboardingImage(file.type, bytes);
  if (!check.ok) return fail(check.status, check.error);

  try {
    const result = await new Promise<{ secure_url?: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: ONBOARDING_UPLOAD_FOLDER,
            resource_type: 'image',
            allowed_formats: ONBOARDING_ALLOWED_FORMATS,
            tags: ONBOARDING_UPLOAD_TAGS,
            use_filename: false,
            unique_filename: true,
            overwrite: false,
          },
          (error, res) => {
            if (error || !res) reject(error ?? new Error('Empty Cloudinary response'));
            else resolve(res as { secure_url?: string });
          }
        )
        .end(Buffer.from(bytes));
    });

    if (!result.secure_url || !result.secure_url.startsWith('https://')) {
      console.error('POST /api/vendor-applications/upload: Cloudinary returned no https URL');
      return fail(500, 'Upload failed');
    }
    return NextResponse.json({ success: true, url: result.secure_url });
  } catch (err) {
    console.error('POST /api/vendor-applications/upload failed:', err);
    return fail(500, 'Upload failed');
  }
}
