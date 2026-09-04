import Link from 'next/link';
import {
  ArrowRight, CalendarDays, CheckSquare,
  ClipboardList, Clock3, CreditCard, Plus, UserPlus, Users,
} from 'lucide-react';
import type { CommandCenter as CommandCenterData } from '@/services/commandCenter.service';

function money(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function dateLabel(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: typeof Users; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></div>
      <div className="text-2xl font-bold text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

export default function CommandCenter({ data }: { data: CommandCenterData }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">Vivah OS</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Command Center</h1>
        <p className="mt-1 text-sm text-slate-500">The operational view of every live event, client, and next action.</p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Today</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="New leads" value={data.today.newLeads} icon={UserPlus} tone="bg-rose-50 text-rose-600" />
          <Metric label="Follow-ups due" value={data.today.followUpsDue} icon={Clock3} tone="bg-amber-50 text-amber-600" />
          <Metric label="Tasks due" value={data.today.tasksDue} icon={CheckSquare} tone="bg-blue-50 text-blue-600" />
          <Metric label="Upcoming events" value={data.today.upcomingEvents} icon={CalendarDays} tone="bg-violet-50 text-violet-600" />
          <Metric label="Payments due" value={data.today.paymentsDue} icon={CreditCard} tone="bg-orange-50 text-orange-600" />
          <Metric label="Events today" value={data.today.eventsToday} icon={ClipboardList} tone="bg-emerald-50 text-emerald-600" />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">Pipeline</h2><Link href="/admin/crm" className="text-xs font-semibold text-rose-600">Open CRM <ArrowRight className="ml-1 inline h-3 w-3" /></Link></div>
          <div className="grid grid-cols-5 gap-2">
            {data.pipeline.map((stage) => <div key={stage.label} className="min-w-0 rounded-xl bg-slate-50 p-3 text-center"><div className="text-xl font-bold text-slate-950">{stage.count}</div><div className="mt-1 text-[11px] leading-tight text-slate-500">{stage.label}</div></div>)}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Quick actions</h2>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/admin/crm" className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700 hover:border-rose-300"><UserPlus className="h-4 w-4 text-rose-600" /> New lead</Link>
            <Link href="/admin/crm" className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700 hover:border-rose-300"><Users className="h-4 w-4 text-rose-600" /> New client</Link>
            <Link href="/admin/events/new" className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700 hover:border-rose-300"><CalendarDays className="h-4 w-4 text-rose-600" /> New event</Link>
            <Link href="/admin/crm" className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700 hover:border-rose-300"><Plus className="h-4 w-4 text-rose-600" /> New task</Link>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">Upcoming events</h2><Link href="/admin/weddings" className="text-xs font-semibold text-rose-600">View all <ArrowRight className="ml-1 inline h-3 w-3" /></Link></div>
        {data.upcomingEvents.length === 0 ? <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">No upcoming events yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-2 font-medium">Event / client</th><th className="pb-2 font-medium">Type</th><th className="pb-2 font-medium">Date</th><th className="pb-2 font-medium">Location</th><th className="pb-2 font-medium">Guests</th><th className="pb-2 font-medium">Status</th><th className="pb-2 font-medium">Coordinator</th></tr></thead><tbody>{data.upcomingEvents.map((event) => <tr key={event.id} className="border-t border-slate-100"><td className="py-3 font-semibold text-slate-900"><Link href={`/admin/weddings/${event.weddingId}`} className="hover:text-rose-600">{event.name}</Link></td><td className="py-3 text-slate-600">{event.type}</td><td className="py-3 text-slate-600">{dateLabel(event.date)}</td><td className="py-3 text-slate-600">{event.location}</td><td className="py-3 text-slate-600">{event.guestCount ?? '—'}</td><td className="py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{event.status}</span></td><td className="py-3 text-slate-600">{event.coordinator}</td></tr>)}</tbody></table></div>}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Tasks</h2>
          <div className="mb-4 grid grid-cols-3 gap-2 text-center"><div><div className="text-xl font-bold text-red-600">{data.tasks.overdue}</div><div className="text-xs text-slate-500">Overdue</div></div><div><div className="text-xl font-bold text-amber-600">{data.tasks.dueToday}</div><div className="text-xs text-slate-500">Due today</div></div><div><div className="text-xl font-bold text-blue-600">{data.tasks.upcoming}</div><div className="text-xs text-slate-500">Upcoming</div></div></div>
          {data.tasks.items.length === 0 ? <p className="text-sm text-slate-500">No open tasks in the next week.</p> : <div className="space-y-2">{data.tasks.items.slice(0, 6).map((task) => <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><span className="truncate text-sm font-medium text-slate-700">{task.title}</span><span className="shrink-0 text-xs text-slate-500">{task.dueAt ? dateLabel(task.dueAt) : 'No date'}</span></div>)}</div>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">Finance</h2><span className="text-lg font-bold text-rose-600">{money(data.finance.outstanding)} outstanding</span></div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Payments due</h3>
          {data.finance.duePayments.length === 0 ? <p className="mb-4 text-sm text-slate-500">No outstanding client payments.</p> : <div className="mb-4 space-y-2">{data.finance.duePayments.slice(0, 5).map((payment) => <div key={payment.id} className="flex items-center justify-between rounded-xl bg-amber-50 p-3 text-sm"><span className="font-medium text-slate-700">{payment.clientName} <span className="text-xs text-slate-500">({payment.invoiceNumber})</span></span><span className="font-bold text-amber-700">{money(payment.amount)}</span></div>)}</div>}
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent payments</h3>
          {data.finance.recentPayments.length === 0 ? <p className="text-sm text-slate-500">No payments recorded yet.</p> : <div className="space-y-2">{data.finance.recentPayments.slice(0, 4).map((payment) => <div key={payment.id} className="flex items-center justify-between text-sm"><span className="text-slate-600">{payment.clientName} · {payment.method}</span><span className="font-semibold text-emerald-700">+{money(payment.amount)}</span></div>)}</div>}
        </section>
      </div>
    </div>
  );
}
