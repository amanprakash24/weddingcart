import type { Role } from '@/lib/auth/roles';
import { canSeeCompanyFinancials } from '@/lib/auth/financialAccess';

// The old cart Bookings screen (/admin?tab=bookings). A cart booking belongs to nobody on the team, so its money is company
// financials (founder decision, 21 Nov 2026): the total and the item prices go only to the founder; for everyone else they are
// null. Names, contacts, items, dates and follow-up status stay open to the team. Pure, so it is tested directly.

type WithMoney = { total: number | null; items?: { price: number | null }[] };

export function bookingMoneyView<B extends WithMoney>(roles: readonly Role[] | null | undefined, booking: B): B {
  if (canSeeCompanyFinancials(roles)) return booking;
  return {
    ...booking,
    total: null,
    ...(booking.items ? { items: booking.items.map((item) => ({ ...item, price: null })) } : {}),
  };
}

// Confirming a cart booking turns it into a wedding with its money (app/api/bookings/[id]) — the founder does that. The team may
// still mark it new, contacted or closed.
export function canSetBookingStatus(roles: readonly Role[] | null | undefined, status: string): boolean {
  return status !== 'CONFIRMED' || canSeeCompanyFinancials(roles);
}
