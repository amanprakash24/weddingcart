import { NextRequest, NextResponse } from 'next/server';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';

// Shared by the public proposal routes (/api/proposal/[token]/*). Kept apart from the routes so both behave the same.

// Every response from a proposal route: never cached, never indexed.
export const PROPOSAL_HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } as const;

// Public actions (accept / request changes): a handful per IP per 15 minutes is far above normal use.
export const PROPOSAL_ACTION_LIMIT = { max: 10, windowMinutes: 15 } as const;

export function clientIp(req: NextRequest): string {
  // Vercel sets x-forwarded-for; the first entry is the original client.
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

// Checked BEFORE the token is even looked at, so guessing links costs the guesser their quota.
export async function proposalRateLimited(req: NextRequest): Promise<boolean> {
  const id = `proposal-action:${clientIp(req)}`;
  if (await isRequestRateLimited(id, PROPOSAL_ACTION_LIMIT)) return true;
  await recordRequest(id);
  return false;
}

export function proposalJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: PROPOSAL_HEADERS });
}

// One generic message for every not-found flavour (bad / revoked / superseded / draft link) — never says which.
export function proposalError(err: unknown): NextResponse {
  if (err instanceof NotFoundError) return proposalJson({ success: false, error: 'This link is no longer valid' }, 404);
  if (err instanceof ConflictError) return proposalJson({ success: false, error: err.message }, 409);
  if (err instanceof ValidationError) return proposalJson({ success: false, error: err.message }, 400);
  console.error('proposal route failed:', err);
  return proposalJson({ success: false, error: 'Something went wrong — please try again' }, 500);
}
