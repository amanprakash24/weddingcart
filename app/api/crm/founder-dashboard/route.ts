import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { canSeeCompanyFinancials } from '@/lib/auth/financialAccess';
import { founderDashboardService } from '@/services/founderDashboard.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// Today / Command Center, for the whole internal team. Its company-wide money (revenue, commission, revenue by month,
// outstanding and recent payments) goes only to people who may see company financials (lib/auth/financialAccess.ts); for
// everyone else those blocks are null and are not even read from the database.
async function handleGET(req: NextRequest) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get('date');
  const date = dateParam ? new Date(dateParam) : new Date();

  try {
    const dashboard = await founderDashboardService.getDashboard(date, {
      includeFinancials: canSeeCompanyFinancials(session.user.roles),
    });
    return NextResponse.json({ success: true, data: dashboard });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
