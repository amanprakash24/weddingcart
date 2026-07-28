import type { LeadWorkspace } from './types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}

// Named for reuse, not "LeadDetailsCard" — post-conversion this same shape
// (date/type/guestCount/budget/venueType) is populated from Wedding/
// WeddingEvent instead of the capture entity's own fields (see the Sprint
// 5.2 plan's "Data model" note on the parallel weddingWorkspace adapter).
export default function WeddingDetailsCard({ details }: { details: LeadWorkspace['weddingDetails'] }) {
  const hasAnyDetail = details.date || details.type || details.guestCount || details.budget || details.venueType;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-2">Wedding Details</h2>
      {hasAnyDetail ? (
        <>
          <Row label="Date" value={details.date ?? '—'} />
          <Row label="Type" value={details.type ?? '—'} />
          <Row label="Guests" value={details.guestCount != null ? String(details.guestCount) : '—'} />
          <Row label="Budget" value={details.budget != null ? `₹${details.budget.toLocaleString('en-IN')}` : '—'} />
          <Row label="Venue Type" value={details.venueType ?? '—'} />
          {details.services.length > 0 && (
            <div className="pt-2 flex flex-wrap gap-1.5">
              {details.services.map((s) => (
                <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{s}</span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-400">No wedding details captured yet.</p>
      )}
    </div>
  );
}
