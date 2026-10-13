import Link from 'next/link';
import DeleteLead from './DeleteLead';
import { STAGE_LABELS, STAGE_COLORS, SOURCE_LABELS, type LeadInboxItem } from './types';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// onDeleted is given only to the founder (components/crm/CrmDashboardClient.tsx): it adds the Delete column.
export default function LeadTable({ items, loading, onDeleted }: { items: LeadInboxItem[]; loading: boolean; onDeleted?: (name: string) => void }) {
  if (loading) {
    return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">Loading…</div>;
  }

  if (items.length === 0) {
    return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">No leads match these filters.</div>;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="px-4 py-3 font-medium">Source</th>
            <th className="px-4 py-3 font-medium">Name / Phone</th>
            <th className="px-4 py-3 font-medium">City</th>
            <th className="px-4 py-3 font-medium">Stage</th>
            <th className="px-4 py-3 font-medium">Assigned To</th>
            <th className="px-4 py-3 font-medium">Received</th>
            {onDeleted && <th className="px-4 py-3 font-medium"><span className="sr-only">Delete</span></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.sourceType}-${item.id}`} className="relative border-b border-gray-50 last:border-0 hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-500">
                <Link href={`/admin/crm/leads/${item.sourceType}/${item.id}`} className="absolute inset-0" aria-label={`Open ${item.name ?? item.phone}`} />
                {SOURCE_LABELS[item.sourceType]}
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{item.name ?? '—'}</div>
                <div className="text-gray-500 text-xs">{item.phone}</div>
              </td>
              <td className="px-4 py-3 text-gray-600">{item.city ?? '—'}</td>
              <td className="px-4 py-3">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STAGE_COLORS[item.pipelineStage]}`}>
                  {STAGE_LABELS[item.pipelineStage]}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600">{item.assignedToName ?? 'Unassigned'}</td>
              <td className="px-4 py-3 text-gray-500 text-xs">{timeAgo(item.createdAt)}</td>
              {onDeleted && (
                // Above the row-wide link, so a tap here deletes instead of opening the lead.
                <td className="relative z-10 px-4 py-2 text-right">
                  <DeleteLead sourceType={item.sourceType} id={item.id} compact onDeleted={onDeleted} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
