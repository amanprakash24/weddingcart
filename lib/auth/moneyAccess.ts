import type { Role } from '@/lib/auth/roles';
import { canSeeCompanyFinancials } from '@/lib/auth/financialAccess';

// Record-level money for the internal team (founder decisions, 21 Nov 2026):
//
//  • Company financials (founder, later finance leadership) see and work every record's money.
//  • Sales / Operations see and work the money on records ASSIGNED to them:
//      - a lead / enquiry / consultation whose `assignedToId` is them, while it has no wedding yet;
//      - a wedding whose `coordinatorId` is them.
//  • After booking, the person who owned the lead keeps READ-ONLY sight of that wedding's payment status (invoices, payments)
//    — not vendor prices or payouts, and no changes.
//  • Records with nobody assigned: founder only.
//  • Shaadi Shopping's commission (rate and amount on vendor payouts) stays company financials, even for the coordinator.
//  • Only the founder assigns leads and coordinators, so nobody can give themselves access.
//
// Pure (no database): services/moneyAccess.service.ts loads the assignment fields and asks these functions.

export type MoneyAccess = 'full' | 'read' | 'none';

export interface Viewer {
  userId: string | null | undefined;
  roles: readonly Role[] | null | undefined;
}

const RANK: Record<MoneyAccess, number> = { none: 0, read: 1, full: 2 };

export function hasMoneyAccess(access: MoneyAccess, needed: Exclude<MoneyAccess, 'none'>): boolean {
  return RANK[access] >= RANK[needed];
}

const isMe = (viewer: Viewer, userId: string | null | undefined) => Boolean(viewer.userId) && viewer.userId === userId;

export interface WeddingAssignment {
  coordinatorId: string | null;
  // Who owned the lead / enquiry / consultation the wedding was booked from (null when it had none, or nobody was assigned).
  sourceAssignedToId: string | null;
}

export function weddingMoneyAccess(viewer: Viewer, wedding: WeddingAssignment): MoneyAccess {
  if (canSeeCompanyFinancials(viewer.roles)) return 'full';
  if (isMe(viewer, wedding.coordinatorId)) return 'full';
  if (isMe(viewer, wedding.sourceAssignedToId)) return 'read';
  return 'none';
}

export interface SourceAssignment {
  assignedToId: string | null;
  // The wedding it became, if it has been booked. From then on the wedding's rules apply to its money (quotes included).
  wedding: { coordinatorId: string | null } | null;
}

export function sourceMoneyAccess(viewer: Viewer, source: SourceAssignment): MoneyAccess {
  if (canSeeCompanyFinancials(viewer.roles)) return 'full';
  if (source.wedding) {
    return weddingMoneyAccess(viewer, { coordinatorId: source.wedding.coordinatorId, sourceAssignedToId: source.assignedToId });
  }
  return isMe(viewer, source.assignedToId) ? 'full' : 'none';
}

// Vendor prices and payouts on a wedding: what the wedding owes and pays its vendors. Needed to run the wedding, so the
// coordinator (full access) sees them; the former lead owner (read access) does not.
export function canSeeVendorMoney(access: MoneyAccess): boolean {
  return access === 'full';
}

// Shaadi Shopping's commission on a payout — company financials only.
export function canSeeCommission(viewer: Viewer): boolean {
  return canSeeCompanyFinancials(viewer.roles);
}

// A payout as returned to someone who may not see commission: the rate and amount are zeroed (the screen hides them).
export function withoutCommission<P extends { commissionRate: unknown; commissionAmount: unknown }>(viewer: Viewer, payout: P): P {
  return canSeeCommission(viewer) ? payout : { ...payout, commissionRate: 0, commissionAmount: 0 };
}

// Assigning a lead or a wedding's coordinator decides who sees its money, so only company financials (the founder) may do it.
export function canAssignWork(viewer: Viewer): boolean {
  return canSeeCompanyFinancials(viewer.roles);
}
