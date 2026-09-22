import type { WorkspaceWeddingEvent } from './types';
import { functionLabel, type VendorRow } from '@/lib/wedding/controlRoom';

const REQUIREMENTS = ['Venue', 'Decoration', 'Catering', 'Photography', 'Videography', 'DJ', 'SFX', 'Makeup', 'Entertainment', 'Transport', 'Accommodation', 'Other'];

function matches(category: string, requirement: string): boolean {
  const value = category.toLowerCase();
  return requirement === 'Other'
    ? !REQUIREMENTS.slice(0, -1).some((name) => value.includes(name.toLowerCase()))
    : value.includes(requirement.toLowerCase());
}

// One line per kind of service the wedding needs: which function, what state it is in, what was quoted, what was agreed, and who has it.
// A quoted service nobody is booked for yet shows as "Needs a vendor" with its quoted price as the estimate; a cancelled vendor is not listed.
export default function ServiceRequirements({ events, unassigned }: { events: WorkspaceWeddingEvent[]; unassigned: VendorRow[] }) {
  const rows = REQUIREMENTS.map((name) => {
    const bookings = events.flatMap((event) => event.vendorBookings.filter((booking) => booking.status !== 'CANCELLED' && matches(booking.vendorCategory, name)).map((booking) => ({ ...booking, functionName: functionLabel(event) })));
    const waiting = unassigned.filter((row) => matches(row.category, name));
    return { name, bookings, waiting };
  });

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <h2 className="mb-3 text-lg font-bold text-gray-900">Services & requirements</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-400"><tr><th className="pb-2 font-medium">Requirement</th><th className="pb-2 font-medium">Function</th><th className="pb-2 font-medium">Status</th><th className="pb-2 font-medium">Estimated</th><th className="pb-2 font-medium">Final</th><th className="pb-2 font-medium">Assigned partner</th></tr></thead>
          <tbody>{rows.map((row) => {
            const total = row.bookings.reduce((sum, booking) => sum + booking.agreedPrice, 0);
            const estimate = row.waiting.reduce((sum, r) => sum + (r.quotedPrice ?? 0), 0);
            const functions = [...row.bookings.map((booking) => booking.functionName), ...row.waiting.map((r) => r.functionName ?? '')].filter(Boolean);
            const status = [...row.bookings.map((booking) => booking.status.replaceAll('_', ' ').toLowerCase()), ...row.waiting.map(() => 'needs a vendor')].join(', ');
            return (
              <tr key={row.name} className="border-t border-gray-100">
                <td className="py-2 font-medium text-gray-900">{row.name}</td>
                <td className="py-2 text-gray-600">{functions.join(', ') || '—'}</td>
                <td className="py-2 capitalize text-gray-600">{status || 'Not assigned'}</td>
                <td className="py-2 text-gray-500">{estimate > 0 ? `₹${estimate.toLocaleString('en-IN')}` : '—'}</td>
                <td className="py-2 font-medium text-gray-700">{row.bookings.length ? `₹${total.toLocaleString('en-IN')}` : '—'}</td>
                <td className="py-2 text-gray-600">{row.bookings.map((booking) => booking.vendorName).join(', ') || '—'}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      {events.length === 0 && <p className="mt-3 text-sm text-gray-400">Add a function before assigning service requirements.</p>}
    </div>
  );
}
