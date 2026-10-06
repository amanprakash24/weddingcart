import type { NextRequest } from 'next/server';
import { proposalService } from '@/services/proposal.service';
import { proposalError, proposalJson, proposalRateLimited } from '@/lib/quotation/proposalHttp';
import { PROOF_MAX_BYTES } from '@/lib/payments/customerPayment';
import { proposalScoped } from '@/lib/quotation/proposalEntry';

// POST /api/proposal/[token]/payments — "I have paid" (Roadmap 1.3, 08-quotation.md §20). Public; the secret token is the only key.
// multipart/form-data: amount, utr, paidOn (YYYY-MM-DD, optional), note (optional), proof (photo or PDF, optional).
// Records a claim for staff to verify. It is NOT a payment: nothing is counted, held or confirmed until staff verify it.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (await proposalRateLimited(req)) return proposalJson({ success: false, error: 'Too many attempts — please try again later' }, 429);
  // Refuse an oversized body before reading it (the screenshot limit plus room for the text fields).
  if (Number(req.headers.get('content-length') ?? 0) > PROOF_MAX_BYTES + 64 * 1024) return proposalJson({ success: false, error: 'The screenshot must be under 5 MB' }, 413);
  try {
    const form = await req.formData().catch(() => null);
    if (!form) return proposalJson({ success: false, error: 'Please fill in the payment details' }, 400);
    const file = form.get('proof');
    const proof = file instanceof File && file.size > 0 ? { bytes: Buffer.from(await file.arrayBuffer()), type: file.type, size: file.size } : null;
    const text = (k: string) => (typeof form.get(k) === 'string' ? (form.get(k) as string) : undefined);
    const result = await proposalService.submitPayment((await params).token, { amount: text('amount'), utr: text('utr'), paidOn: text('paidOn'), note: text('note') }, proof);
    return proposalJson({ success: true, data: { payments: result.payments } }, 201);
  } catch (err) {
    return proposalError(err);
  }
}

// Record ownership: runs as the business that owns the quotation behind this link (lib/quotation/proposalEntry.ts).
export const POST = proposalScoped(handlePOST);
