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

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-');
  return `${MONTH_NAMES[Number(monthNum) - 1]} ${year}`;
}

export default function RevenueByMonthCard({ revenueByMonth }: { revenueByMonth: FounderDashboard['revenueByMonth'] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-2">Revenue by Month</h2>
      {revenueByMonth.map((row) => (
        <Row key={row.month} label={formatMonthLabel(row.month)} value={formatInr(row.total)} />
      ))}
    </div>
  );
}
