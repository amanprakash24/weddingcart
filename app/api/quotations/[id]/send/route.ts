import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { quotationService } from '@/services/quotation.service';

// POST /api/quotations/[id]/send — DRAFT → SENT. 400 if it has no lines or no future valid-until date,
// 409 if it is not a draft. `stageAdvanced` says whether the CRM stage moved to Quotation Sent too.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { quotation, stageAdvanced } = await quotationService.send((await params).id, session.user.id ?? null);
    return NextResponse.json({ success: true, data: quotation, stageAdvanced });
  } catch (err) {
    return handleApiError(err);
  }
}
