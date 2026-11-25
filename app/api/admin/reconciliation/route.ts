import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { canSeeCompanyFinancials } from '@/lib/auth/financialAccess';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { reconciliationService } from '@/services/reconciliation.service';

// GET /api/admin/reconciliation — the founder's money reconciliation (money design v1, PR 2, 25 Nov 2026). Read-only checks over
// invoices, agreements, vendor money and the finance audit log. Founder only: it shows commission-derived figures and every
// vendor's money (lib/auth/financialAccess.ts); coordinators and other staff are refused.
async function handleGET() {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  if (!canSeeCompanyFinancials(session.user.roles)) return NextResponse.json({ success: false, error: 'Only the founder can see the money check' }, { status: 403 });
  try {
    return NextResponse.json({ success: true, data: await reconciliationService.report() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
