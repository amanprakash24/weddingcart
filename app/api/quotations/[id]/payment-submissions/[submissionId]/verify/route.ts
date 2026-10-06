import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { paymentSubmissionService } from '@/services/paymentSubmission.service';

const body = z.object({ amount: z.number().int().positive().optional(), paidAt: z.string().datetime().optional() });

// POST /api/quotations/[id]/payment-submissions/[submissionId]/verify — staff found the money in the bank. Records the payment through
// the normal Money v1 path (25% rule, hold, auto-confirm). Safe to press twice. Body: { amount?, paidAt? } to correct what arrived.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; submissionId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const input = body.parse(await req.json().catch(() => ({})));
    const { id, submissionId } = await params;
    const data = await paymentSubmissionService.verify(id, submissionId, { amount: input.amount, paidAt: input.paidAt ? new Date(input.paidAt) : null }, session.user.id ?? null);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
