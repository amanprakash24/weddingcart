import { PLATFORM_BUSINESS_ID } from '@/lib/ownership/owned';

// Shaadi Shopping's own service on every wedding it plans (26 Nov 2026, founder's decision): "Wedding planning & coordination",
// shown on the quotation, the invoice, the staff wedding page, the website's planning category and the couple's plan — always
// as INCLUDED, never with a price. It is not a quotation line: it never changes a subtotal, GST, the 25% advance, an invoice
// total or a vendor payout. Pure, so client screens can use it.

export const SS_PLANNING = {
  provider: 'Shaadi Shopping',
  service: 'Wedding planning & coordination',
  included: 'Included',
  // One line on what it covers — in the words the site already uses (one dedicated Wedding Expert from booking to vidaai).
  covers: 'Your dedicated Wedding Expert plans and coordinates every function, from booking to vidaai.',
} as const;

// Whether a record belongs to Shaadi Shopping (and so carries the planning & coordination row). A venue's own quotation,
// invoice or wedding never does.
export function isShaadiShoppingBusiness(businessId: string | null | undefined): boolean {
  return businessId === PLATFORM_BUSINESS_ID;
}

// "All functions: Haldi, Wedding" / "Your whole wedding" — what the row is for.
export function planningScope(functionLabels: readonly string[]): string {
  const names = [...new Set(functionLabels.map((f) => f.trim()).filter(Boolean))];
  return names.length ? `All functions: ${names.join(', ')}` : 'Your whole wedding';
}
