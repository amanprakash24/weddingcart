import { NextResponse } from 'next/server';
import { statsService } from '@/services/stats.service';
import { getSession } from '@/lib/auth/session';
import { hasAdminRole } from '@/lib/auth/permissions';
import { canSeeCompanyFinancials } from '@/lib/auth/financialAccess';
import { platformScoped } from '@/lib/ownership/entry';

async function handleGET() {
  const session = await getSession();
  if (!session?.user || !hasAdminRole(session.user.roles)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Total booking revenue is company-wide money: only for people who may see company financials, null for the rest.
    const data = await statsService.get({ includeRevenue: canSeeCompanyFinancials(session.user.roles) });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('GET /api/stats failed:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
