import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import type { SourceType } from '@/services/leadInbox.service';
import { hasMoneyAccess, type MoneyAccess } from '@/lib/auth/moneyAccess';
import { canSeeCompanyFinancials } from '@/lib/auth/financialAccess';

// The check every staff API route that shows or changes a record's money makes first (rules: lib/auth/moneyAccess.ts).
//
//   const guard = await moneyGuard({ wedding: id }, 'full');
//   if (guard instanceof NextResponse) return guard;
//   const { session, access } = guard;
//
// 401 when not signed in to the Command Center; 403 when signed in but this record's money is not theirs (or only readable and
// the route changes something).

export type MoneyTarget = { wedding: string } | { quotation: string } | { source: { sourceType: SourceType; id: string } };

type StaffSession = NonNullable<Awaited<ReturnType<typeof requireRole>>>;

export async function moneyAccessFor(session: StaffSession, target: MoneyTarget): Promise<MoneyAccess> {
  const viewer = { userId: session.user.id ?? null, roles: session.user.roles ?? [] };
  // The founder sees every record's money — answered without a database read (and without loading the database layer).
  if (canSeeCompanyFinancials(viewer.roles)) return 'full';
  const { moneyAccessService } = await import('@/services/moneyAccess.service');
  if ('wedding' in target) return moneyAccessService.forWedding(viewer, target.wedding);
  if ('quotation' in target) return moneyAccessService.forQuotation(viewer, target.quotation);
  return moneyAccessService.forSource(viewer, target.source.sourceType, target.source.id);
}

// The same check for routes that already load their own session: returns the refusal to send, or null to go ahead.
export async function moneyDenied(target: MoneyTarget, needed: Exclude<MoneyAccess, 'none'>): Promise<NextResponse | null> {
  const guard = await moneyGuard(target, needed);
  return guard instanceof NextResponse ? guard : null;
}

export async function moneyGuard(
  target: MoneyTarget,
  needed: Exclude<MoneyAccess, 'none'>
): Promise<{ session: StaffSession; access: MoneyAccess } | NextResponse> {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const access = await moneyAccessFor(session, target);
  if (!hasMoneyAccess(access, needed)) {
    const error =
      access === 'read'
        ? 'You can see this wedding’s payments but not change them — ask its coordinator or the founder.'
        : 'Only the person this is assigned to (or the founder) can see its money.';
    return NextResponse.json({ success: false, error }, { status: 403 });
  }
  return { session, access };
}
