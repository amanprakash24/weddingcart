import { Role } from '@/lib/auth/roles';

// Company-wide financial intelligence (founder decision, 21 Nov 2026): total revenue, collections, outstanding across all
// clients, commission, margin, revenue by month, recent payments and the full invoice list are for the founder (and, later,
// explicitly authorised finance leadership) only. Sales and Operations keep what their own work needs: the money on the
// lead, booking or wedding they are working on (those screens are unchanged), and operational counts such as
// "payments due" on Today.
//
// One list, so a future finance-lead grant is a change here and not in every route. Pure and client-safe.
export const COMPANY_FINANCIAL_ROLES: readonly Role[] = [Role.SUPER_ADMIN];

export function canSeeCompanyFinancials(roles: readonly Role[] | null | undefined): boolean {
  return (roles ?? []).some((role) => COMPANY_FINANCIAL_ROLES.includes(role));
}
