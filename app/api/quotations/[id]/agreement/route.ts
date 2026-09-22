import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { loadAgreementMoney } from '@/services/agreement.service';

// GET /api/quotations/[id]/agreement — the Money card for an accepted quotation: what was agreed, how much confirms the booking, how much
// has been received, whether the date is held (and for how long), and what to do next. Read-only; creates nothing.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ success: true, data: await loadAgreementMoney((await params).id) });
  } catch (err) {
    return handleApiError(err);
  }
}
