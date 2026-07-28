import type { FounderDashboard } from './types';

const STATUS_ICON: Record<string, string> = {
  AVAILABLE: '✅',
  TENTATIVE: '⚠️',
  BOOKED: '❌',
  BLOCKED: '❌',
};

// 0 vendor_availability rows exist on staging today (confirmed before
// planning) — this renders a real empty state, not a broken grid, until
// vendors/coordinators start recording availability.
export default function VendorAvailabilityCard({ vendorAvailability }: { vendorAvailability: FounderDashboard['vendorAvailability'] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-2">Vendor Availability — {vendorAvailability.date}</h2>
      {vendorAvailability.categories.length === 0 ? (
        <p className="text-sm text-gray-400">No availability data recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {vendorAvailability.categories.map(({ category, counts }) => (
            <li key={category} className="flex items-center justify-between text-sm">
              <span className="text-gray-900 capitalize">{category}</span>
              <span className="flex gap-3 text-gray-600">
                {Object.entries(counts).map(([status, count]) => (
                  <span key={status}>{STATUS_ICON[status] ?? ''} {count}</span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
