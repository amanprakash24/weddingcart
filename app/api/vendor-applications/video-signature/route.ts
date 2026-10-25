import { NextRequest, NextResponse } from 'next/server';
import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import { onboardingVideoSignature } from '@/lib/onboardingVideo';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/vendor-applications/video-signature — public, used ONLY by /vendor-onboarding for its one tour video (25 Oct 2026).
// A video is too big to pass through our own route (Vercel caps a request at 4.5 MB), so the browser sends it straight to
// Cloudinary with this signature. The signature fixes the folder and a random file name and cannot overwrite, so each one is
// good for a single upload; the size and length are checked when the registration is sent (POST /api/vendor-applications).
const RATE_LIMIT_PREFIX = 'onboarding-video:';
// One video per registration; room for a few retries and a shared (mobile-carrier) IP.
const RATE_LIMIT = { max: 6, windowMinutes: 15 };

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

// Browsers always send Origin on cross-site POSTs; refuse other websites.
function isCrossOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.get('host');
  } catch {
    return true;
  }
}

async function handlePOST(req: NextRequest) {
  if (isCrossOrigin(req)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  const rateLimitId = `${RATE_LIMIT_PREFIX}${clientIp(req)}`;
  if (await isRequestRateLimited(rateLimitId, RATE_LIMIT)) {
    return NextResponse.json({ success: false, error: 'Too many uploads. Please try again in a few minutes.' }, { status: 429 });
  }
  await recordRequest(rateLimitId);
  if (!process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_CLOUD_NAME) {
    return NextResponse.json({ success: false, error: 'Video upload is not available right now.' }, { status: 503 });
  }
  return NextResponse.json({ success: true, ...onboardingVideoSignature() }, { headers: { 'Cache-Control': 'no-store' } });
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
