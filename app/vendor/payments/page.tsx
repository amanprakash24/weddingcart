import { sharedPage } from '@/lib/auth/workingVendor';
import { vendorPaymentService } from '@/services/vendorPayment.service';
import VendorPaymentsScreen from '@/components/vendor/VendorPaymentsScreen';
import MoneyToCollect from '@/components/vendor/payments/MoneyToCollect';
import { platformScoped } from '@/lib/ownership/entry';

export const metadata = {
  title: 'Payments | Shaadi Shopping',
  robots: { index: false, follow: false },
};

// Money: only for the owner and anyone they let see it. Since 25 Nov 2026 the figures come from vendorPaymentService.forVendor —
// lib/vendor/vendorMoney.ts, the same calculation as the team's wedding page — not from payouts alone (which showed ₹0 for
// confirmed work).
async function VendorPaymentsPage() {
  const who = await sharedPage('view_financials');
  const { totals, works } = await vendorPaymentService.forVendor(who.vendorId);
  // The business's OWN bookings first (what its own couples still owe, loaded venue-scoped from /api/vendor-os/collections); the
  // payouts from Shaadi Shopping below (Shaadi Shopping's records — this page's own scope).
  // A vendor working through Shaadi Shopping sees that money first (25 Nov 2026: their own-bookings box said "₹0" above it, and
  // read as if Shaadi Shopping's work was worth nothing); a business with no Shaadi Shopping work keeps its own bookings first.
  const own = (
    <div className="mx-auto max-w-3xl px-3 pt-6 sm:px-6">
      <MoneyToCollect />
    </div>
  );
  const fromUs = <VendorPaymentsScreen totals={totals} works={works} />;
  return works.length > 0 ? (
    <>
      {fromUs}
      {own}
    </>
  ) : (
    <>
      {own}
      {fromUs}
    </>
  );
}

// Record ownership: this page works as Shaadi Shopping (lib/ownership/entry.ts).
export default platformScoped(VendorPaymentsPage);
