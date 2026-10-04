import type { NextRequest } from 'next/server';
import { proposalService } from '@/services/proposal.service';
import { proposalError, proposalJson, proposalRateLimited } from '@/lib/quotation/proposalHttp';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/proposal/[token]/accept — the couple accepts the proposal (public; the secret token is the only key).
// Body: { agreeToTerms: true }. Idempotent: repeating it answers "accepted" again and creates nothing new.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (await proposalRateLimited(req)) return proposalJson({ success: false, error: 'Too many attempts — please try again later' }, 429);
  try {
    const body = await req.json().catch(() => null);
    if (body?.agreeToTerms !== true) return proposalJson({ success: false, error: 'Please confirm you agree to the terms' }, 400);
    const result = await proposalService.accept((await params).token);
    // bookingCreated is internal — the couple only needs to know they have accepted.
    return proposalJson({ success: true, data: { state: result.state } });
  } catch (err) {
    return proposalError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
