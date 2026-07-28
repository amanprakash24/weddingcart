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

// Real Booking/Invoice revenue — deliberately separate from CommissionCard.
// DRAFT invoices are excluded (not committed revenue yet), so these can
// legitimately read ₹0 while a real invoice sits unsent, per the Sprint 5.4
// plan's Revenue/Commission split.
export default function BusinessPerformanceCard({ revenue }: { revenue: FounderDashboard['revenue'] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-2">Business Performance</h2>
      <Row label="Payments Today" value={formatInr(revenue.paymentsToday)} />
      <Row label="Total Collected" value={formatInr(revenue.totalCollected)} />
      <Row label="Outstanding" value={formatInr(revenue.outstanding)} />
      <Row
        label="Invoiced This Month"
        value={`${formatInr(revenue.invoicedThisMonth.total)} (${revenue.invoicedThisMonth.count})`}
      />
    </div>
  );
}
