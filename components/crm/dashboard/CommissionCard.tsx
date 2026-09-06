import type { FounderDashboard } from './types';

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}

// Explicitly inactive when confirmed=0 — per the agreed framing, this never
// gets conflated with BusinessPerformanceCard's real revenue numbers.
// expected/outstandingPayoutAmount/pendingPayoutCount render regardless of
// isActive, since those derive from CONFIRMED/PENDING states that can exist
// before any PAID payout does.
export default function CommissionCard({ commission }: { commission: FounderDashboard['commission'] }) {
  const isActive = commission.confirmed > 0;

  const divergence = Math.abs(commission.grossMargin - commission.confirmed);
  const showDivergenceNote = divergence > 500 || (commission.confirmed > 0 && divergence / commission.confirmed > 0.01);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-2">Commission</h2>
      <div className="text-2xl font-bold text-gray-900">₹{commission.confirmed.toLocaleString('en-IN')}</div>
      <p className="text-xs text-gray-400 mt-1">Confirmed commission</p>

      <Row label="Expected commission" value={formatInr(commission.expected)} />

      <div className="border-t border-gray-100 pt-3 mt-3">
        <Row label="Outstanding vendor payouts" value={formatInr(commission.outstandingPayoutAmount)} />
        <Row label="Pending payouts" value={String(commission.pendingPayoutCount)} />
        <Row label="Gross margin" value={formatInr(commission.grossMargin)} />
        {showDivergenceNote && (
          <p className="text-xs text-amber-600 mt-1">
            Gross margin differs from confirmed commission — invoices can include GST, discounts, or line items
            outside vendor bookings.
          </p>
        )}
      </div>

      {!isActive && (
        <p className="text-sm text-gray-500 mt-3 border-t border-gray-100 pt-3">
          No completed vendor bookings yet — commission tracking activates once the CRM → Wedding → VendorBooking
          flow is live.
        </p>
      )}

      <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-3">
        Weddings in progress: {commission.pendingWeddings}
      </p>
    </div>
  );
}
