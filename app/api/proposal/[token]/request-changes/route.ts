import type { NextRequest } from 'next/server';
import { proposalService } from '@/services/proposal.service';
import { proposalError, proposalJson, proposalRateLimited } from '@/lib/quotation/proposalHttp';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/proposal/[token]/request-changes — the couple asks for changes (public; the secret token is the only key).
// Body: { note }. Records the request for staff; the quotation itself is never modified here.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (await proposalRateLimited(req)) return proposalJson({ success: false, error: 'Too many attempts — please try again later' }, 429);
  try {
    const body = await req.json().catch(() => null);
    await proposalService.requestChanges((await params).token, body?.note);
    return proposalJson({ success: true });
  } catch (err) {
    return proposalError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
