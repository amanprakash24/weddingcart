import type { FounderDashboard } from './types';

// Explicitly inactive when 0 — per the agreed framing, this never gets
// conflated with BusinessPerformanceCard's real revenue numbers. Activates
// naturally once the CRM -> Wedding -> VendorBooking -> Payout path is live.
export default function CommissionCard({ commission }: { commission: FounderDashboard['commission'] }) {
  const isActive = commission.confirmed > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-2">Commission</h2>
      <div className="text-2xl font-bold text-gray-900">₹{commission.confirmed.toLocaleString('en-IN')}</div>
      <p className="text-xs text-gray-400 mt-1">Confirmed commission</p>
      {!isActive && (
        <p className="text-sm text-gray-500 mt-3 border-t border-gray-100 pt-3">
          No completed vendor bookings yet — commission tracking activates once the CRM → Wedding → VendorBooking
          flow is live.
        </p>
      )}
    </div>
  );
}
