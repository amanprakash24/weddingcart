import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';
import { PROOF_MAX_BYTES } from '@/lib/payments/customerPayment';
import { coupleMoneyService } from '@/services/coupleMoney.service';

// POST /api/customer/weddings/[id]/payment-claims — "I have paid" from My Wedding (22 Nov 2026): multipart amount, utr, paidOn
// (YYYY-MM-DD, optional), note (optional), proof (photo or PDF, optional). A claim for staff to verify — never counted as money until
// they do. The couple's own wedding only (asCoupleWedding); the same rules as the proposal link (services/coupleMoney.service.ts).
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  // Refuse an oversized body before reading it (the screenshot limit plus room for the text fields).
  if (Number(req.headers.get('content-length') ?? 0) > PROOF_MAX_BYTES + 64 * 1024) return NextResponse.json({ success: false, error: 'The screenshot must be under 5 MB' }, { status: 413 });
  try {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ success: false, error: 'Please fill in the payment details' }, { status: 400 });
    const file = form.get('proof');
    const proof = file instanceof File && file.size > 0 ? { bytes: Buffer.from(await file.arrayBuffer()), type: file.type, size: file.size } : null;
    const text = (k: string) => (typeof form.get(k) === 'string' ? (form.get(k) as string) : undefined);
    const { id } = await params;
    const data = await asCoupleWedding(id, session.user.id, () => coupleMoneyService.submitClaim(id, { amount: text('amount'), utr: text('utr'), paidOn: text('paidOn'), note: text('note') }, proof));
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = platformScoped(handlePOST);
