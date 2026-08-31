import type { WorkspaceWeddingEvent } from './types';

const REQUIREMENTS = ['Venue', 'Decoration', 'Catering', 'Photography', 'Videography', 'DJ', 'SFX', 'Makeup', 'Entertainment', 'Transport', 'Accommodation', 'Other'];

function matches(category: string, requirement: string): boolean {
  const value = category.toLowerCase();
  return requirement === 'Other'
    ? !REQUIREMENTS.slice(0, -1).some((name) => value.includes(name.toLowerCase()))
    : value.includes(requirement.toLowerCase());
}

export default function ServiceRequirements({ events }: { events: WorkspaceWeddingEvent[] }) {
  const rows = REQUIREMENTS.map((name) => {
    const bookings = events.flatMap((event) => event.vendorBookings.filter((booking) => matches(booking.vendorCategory, name)).map((booking) => ({ ...booking, functionName: event.label || event.type })));
    return { name, bookings };
  });

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <h2 className="mb-3 text-lg font-bold text-gray-900">Services & requirements</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-400"><tr><th className="pb-2 font-medium">Requirement</th><th className="pb-2 font-medium">Function</th><th className="pb-2 font-medium">Status</th><th className="pb-2 font-medium">Estimated</th><th className="pb-2 font-medium">Final</th><th className="pb-2 font-medium">Assigned partner</th></tr></thead>
          <tbody>{rows.map((row) => {
            const total = row.bookings.reduce((sum, booking) => sum + booking.agreedPrice, 0);
            return <tr key={row.name} className="border-t border-gray-100"><td className="py-2 font-medium text-gray-900">{row.name}</td><td className="py-2 text-gray-600">{row.bookings.map((booking) => booking.functionName).join(', ') || '—'}</td><td className="py-2 text-gray-600">{row.bookings.length ? row.bookings.map((booking) => booking.status.replaceAll('_', ' ')).join(', ') : 'Not assigned'}</td><td className="py-2 text-gray-500">—</td><td className="py-2 font-medium text-gray-700">{row.bookings.length ? `₹${total.toLocaleString('en-IN')}` : '—'}</td><td className="py-2 text-gray-600">{row.bookings.map((booking) => booking.vendorName).join(', ') || '—'}</td></tr>;
          })}</tbody>
        </table>
      </div>
      {events.length === 0 && <p className="mt-3 text-sm text-gray-400">Add a function before assigning service requirements.</p>}
    </div>
  );
}
