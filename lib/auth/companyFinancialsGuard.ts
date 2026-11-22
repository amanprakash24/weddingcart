import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { hasAdminRole } from '@/lib/auth/permissions';
import { canSeeCompanyFinancials } from '@/lib/auth/financialAccess';

// For API routes that show or change company-wide money (lib/auth/financialAccess.ts). Returns the response to send when the
// caller may not — 401 when not signed in to the Command Center, 403 when signed in without company-financials access — or
// null when they may go ahead.
export async function denyUnlessCompanyFinancials(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session?.user || !hasAdminRole(session.user.roles)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!canSeeCompanyFinancials(session.user.roles)) {
    return NextResponse.json({ success: false, error: 'Only the founder can see company finances' }, { status: 403 });
  }
  return null;
}
