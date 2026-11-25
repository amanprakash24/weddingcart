import type { WeddingWorkspace } from '@/services/weddingWorkspace.service';
import { canSeeVendorMoney, type MoneyAccess } from '@/lib/auth/moneyAccess';

// What of a wedding's money the signed-in team member may see (rules: lib/auth/moneyAccess.ts), applied to the Wedding Control
// Room payload in one place (app/api/weddings/[id]/workspace). Pure, so it is tested directly.
//
//   full (founder, coordinator)  everything — except Shaadi Shopping's commission, which only the founder sees
//   read (lead owner after booking) the couple's invoices, payments and agreement; no vendor prices or payouts
//   none (anyone else)           no money at all
//
// Withheld numbers are sent as 0 / null and `money` tells the screens what was withheld, so they show a note instead of a
// misleading ₹0. Amounts written into the activity timeline are masked the same way.

export interface WorkspaceMoneyFlags {
  access: MoneyAccess;
  vendorMoney: boolean; // vendor agreed prices and payouts
  commission: boolean; // Shaadi Shopping's commission on payouts
  assign: boolean; // may choose the coordinator — company financials (the founder) only
}

export const MASKED_AMOUNT = '₹•••';

// "₹1,25,000", "₹2.5 L", "₹ 40,000.50" …
const AMOUNT = /₹\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:L|Cr|K|lakh|crore)\b)?/g;
// The commission phrase in a payout entry: " (₹12,000 commission @ 10%)".
const COMMISSION = /\s*\(₹\s?\d[\d,]*(?:\.\d+)? commission @ \d+(?:\.\d+)?%\)/g;

export function maskAmounts(text: string): string;
export function maskAmounts(text: string | null): string | null;
export function maskAmounts(text: string | null): string | null {
  return text === null ? null : text.replace(AMOUNT, MASKED_AMOUNT);
}

export function maskCommission(text: string): string;
export function maskCommission(text: string | null): string | null;
export function maskCommission(text: string | null): string | null {
  return text === null ? null : text.replace(COMMISSION, '');
}

export function weddingMoneyView<W extends WeddingWorkspace>(
  ws: W,
  access: MoneyAccess,
  seesCommission: boolean
): W & { money: WorkspaceMoneyFlags } {
  const vendorMoney = canSeeVendorMoney(access);
  const commission = seesCommission && vendorMoney;
  // seesCommission is "has company financials", which is also who may assign (lib/auth/moneyAccess.ts canAssignWork).
  const money: WorkspaceMoneyFlags = { access, vendorMoney, commission, assign: seesCommission };

  const events = ws.events.map((event) => ({
    ...event,
    vendorBookings: event.vendorBookings.map((vb) => ({
      ...vb,
      agreedPrice: vendorMoney ? vb.agreedPrice : 0,
      payout: !vendorMoney || !vb.payout ? null : commission ? vb.payout : { ...vb.payout, commissionRate: 0, commissionAmount: 0 },
    })),
  }));

  const finance =
    access === 'none'
      ? { budget: { planned: ws.finance.budget.planned, committed: 0, variance: null }, invoices: [], totals: { invoicedTotal: 0, collected: 0, outstanding: 0, credited: 0, refundOwed: 0 }, agreement: null }
      : vendorMoney
        ? ws.finance
        : { ...ws.finance, budget: { planned: ws.finance.budget.planned, committed: 0, variance: null } };

  const activity = ws.activity.map((entry) => {
    if (access !== 'full') return { ...entry, summary: maskAmounts(entry.summary), detail: maskAmounts(entry.detail) };
    if (!commission) return { ...entry, summary: maskCommission(entry.summary), detail: maskCommission(entry.detail) };
    return entry;
  });

  return { ...ws, events, finance, activity, money };
}
