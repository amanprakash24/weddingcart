import type { NextRequest } from 'next/server';
import { proposalService } from '@/services/proposal.service';
import { proposalError, proposalJson, proposalRateLimited } from '@/lib/quotation/proposalHttp';
import { proposalScoped } from '@/lib/quotation/proposalEntry';

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

// Record ownership: runs as the business that owns the quotation behind this link (lib/quotation/proposalEntry.ts).
export const POST = proposalScoped(handlePOST);
