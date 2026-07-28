import { Flame, CalendarClock, AlertTriangle, Layers } from 'lucide-react';
import type { LeadInboxStats } from './types';

// The lead element of the CRM dashboard, per docs/wedding-os/01-command-center.md
// §3's revised layout — action items first, analytics (StatsCards) below the
// fold. Deliberately shows only what's computable from Lead/Enquiry/Consultation
// alone: Follow-ups and Payments Due (shown in the original mockup) need
// Task/Invoice-Payment data that's out of Sprint 5.1's scope, so they're left
// out here rather than faked as always-zero cards.
export default function TodaysWork({ stats, loading }: { stats: LeadInboxStats | null; loading: boolean }) {
  const cards = [
    { icon: Flame, label: 'New Inquiries Today', value: stats?.newToday, color: 'text-rose-500 bg-rose-50' },
    { icon: CalendarClock, label: 'Site Visits Scheduled', value: stats?.siteVisitsScheduled, color: 'text-cyan-600 bg-cyan-50' },
    { icon: AlertTriangle, label: 'Overdue (no contact 24h+)', value: stats?.overdueCount, color: 'text-amber-600 bg-amber-50' },
    { icon: Layers, label: 'Open Pipeline', value: stats?.totalOpen, color: 'text-violet-600 bg-violet-50' },
  ];

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 font-[Playfair_Display,serif] mb-3">Today&apos;s Work</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{loading ? '—' : (value ?? 0)}</div>
              <div className="text-xs text-gray-500 leading-tight">{label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
