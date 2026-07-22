import type { LeadWorkspace } from './types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}

export default function CustomerCard({ customer }: { customer: LeadWorkspace['customer'] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-2">Customer</h2>
      <Row label="Name" value={customer.name ?? '—'} />
      <Row label="Phone" value={customer.phone} />
      <Row label="Email" value={customer.email ?? '—'} />
      <Row label="City" value={customer.city ?? '—'} />
    </div>
  );
}
