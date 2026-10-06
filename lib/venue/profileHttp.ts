import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import { effectiveScope } from '@/lib/ownership/scope';
import type { ProfileResult } from '@/services/venueProfile.service';

// Shared by the vendor's profile routes (/api/vendor-os/profile/*) so they all answer the same way.
const noStore = { headers: { 'Cache-Control': 'no-store' } };

export function profileAnswer(result: ProfileResult): NextResponse {
  if ('forbidden' in result) return NextResponse.json({ success: false, error: 'Only the owner can change the business profile' }, { status: 403, ...noStore });
  if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400, ...noStore });
  return NextResponse.json({ success: true, data: result }, noStore);
}

export async function profileRoute(work: () => Promise<ProfileResult>): Promise<NextResponse> {
  try {
    return profileAnswer(await work());
  } catch (err) {
    return handleApiError(err);
  }
}

// Uploads cost storage: a business gets a generous but finite number per 15 minutes (12 photos, a logo, retries).
const UPLOAD_LIMIT = { max: 40, windowMinutes: 15 };

export async function uploadsPaused(): Promise<NextResponse | null> {
  const scope = effectiveScope();
  const id = `profile-upload:${scope.kind === 'BUSINESS' ? scope.businessId : 'none'}`;
  if (await isRequestRateLimited(id, UPLOAD_LIMIT)) {
    return NextResponse.json({ success: false, error: 'Too many uploads — please wait a few minutes and try again' }, { status: 429, ...noStore });
  }
  await recordRequest(id);
  return null;
}
