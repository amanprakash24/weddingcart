import type { LeadWorkspace } from './types';

export default function VendorInterestPanel({ vendorInterest }: { vendorInterest: LeadWorkspace['vendorInterest'] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-2">Vendor Interest</h2>
      {vendorInterest.length === 0 ? (
        <p className="text-sm text-gray-400">No vendor interest recorded yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {vendorInterest.map((v, i) => (
            <li key={v.vendorId || `${v.vendorCategory}-${i}`} className="text-sm flex justify-between">
              <span className="text-gray-900">{v.vendorName || v.vendorCategory}</span>
              <span className="text-gray-500 text-xs capitalize">{v.vendorCategory}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
