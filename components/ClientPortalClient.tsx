'use client';

import { useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronRight, Clock3, CreditCard, FileText, MapPin, Users } from 'lucide-react';
import type { ClientPortalEvent } from '@/services/clientPortal.service';
import GuestRsvp from '@/components/wedding/workspace/GuestRsvp';

function money(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

function dateLabel(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date to be confirmed';
}

function Approvals({ approvals, onDecision }: { approvals: ClientPortalEvent['approvals']; onDecision: (id: string, decision: 'APPROVED' | 'CHANGES_REQUESTED', comment?: string) => Promise<void> }) {
  const [comments, setComments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const pending = approvals.filter((approval) => approval.status === 'PENDING_CLIENT' || approval.status === 'CHANGES_REQUESTED');
  const decide = async (id: string, decision: 'APPROVED' | 'CHANGES_REQUESTED') => {
    if (decision === 'APPROVED' && !window.confirm('Approve this request?')) return;
    if (decision === 'CHANGES_REQUESTED' && !comments[id]?.trim()) return;
    setSaving(id);
    try { await onDecision(id, decision, comments[id]); } finally { setSaving(null); }
  };
  return <section className="rounded-2xl border border-rose-100 bg-white p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">What needs your approval?</h2><span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600">{pending.length} pending</span></div>{approvals.length === 0 ? <p className="text-sm text-slate-500">No approval requests right now.</p> : <div className="space-y-3">{approvals.map((approval) => <div key={approval.id} className="rounded-xl bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-900">{approval.title}</h3><span className="text-xs font-medium text-slate-500">{approval.status.replaceAll('_', ' ')}</span></div>{approval.description && <p className="mt-2 text-sm text-slate-600">{approval.description}</p>}<p className="mt-2 text-xs text-slate-500">{approval.functionName || 'Event'} · {approval.type.replaceAll('_', ' ')}{approval.amount !== null ? ` · ${money(approval.amount)}` : ''}{approval.deadline ? ` · Due ${dateLabel(approval.deadline)}` : ''}</p>{approval.clientComment && <p className="mt-2 text-xs text-amber-700">Your note: {approval.clientComment}</p>}{(approval.status === 'PENDING_CLIENT' || approval.status === 'CHANGES_REQUESTED') && <div className="mt-3 space-y-2"><textarea value={comments[approval.id] || ''} onChange={(e) => setComments({ ...comments, [approval.id]: e.target.value })} placeholder="Comment if changes are needed (optional for approval)" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /><div className="flex flex-wrap gap-2"><button disabled={saving === approval.id} onClick={() => decide(approval.id, 'APPROVED')} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve</button><button disabled={saving === approval.id || !comments[approval.id]?.trim()} onClick={() => decide(approval.id, 'CHANGES_REQUESTED')} className="rounded-lg border border-amber-300 px-4 py-2 text-xs font-semibold text-amber-700 disabled:opacity-50">Request changes</button></div></div>}</div>)}</div>}</section>;
}

export default function ClientPortalClient({ events }: { events: ClientPortalEvent[] }) {
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? '');
  const event = events.find((item) => item.id === selectedId) || events[0];
  const [approvalState, setApprovalState] = useState<Record<string, ClientPortalEvent['approvals']>>(() => Object.fromEntries(events.map((item) => [item.id, item.approvals])));

  if (!event) {
    return <main className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="text-2xl font-bold text-slate-900">Your event space is being prepared</h1><p className="mt-2 text-sm text-slate-500">Your Shaadi Shopping contact will share event access once your booking is confirmed.</p></main>;
  }

  const decideApproval = async (approvalId: string, decision: 'APPROVED' | 'CHANGES_REQUESTED', comment?: string) => {
    const response = await fetch(`/api/customer/approvals/${approvalId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, comment }) });
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error(body.error || 'Could not update approval');
    setApprovalState((current) => ({ ...current, [event.id]: (current[event.id] || []).map((approval) => approval.id === approvalId ? { ...approval, status: decision, clientComment: decision === 'CHANGES_REQUESTED' ? comment || null : null } : approval) }));
  };

  return (
    <main className="min-h-screen bg-[#FFFAF5] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl bg-gradient-to-br from-rose-600 to-amber-500 p-6 text-white shadow-lg sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Vivah OS · Client Portal</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div><h1 className="text-3xl font-bold">{event.clientName}</h1><p className="mt-1 text-white/80">{event.eventType} · {event.weddingNumber}</p></div>
            {events.length > 1 && <select value={event.id} onChange={(e) => setSelectedId(e.target.value)} className="rounded-xl border border-white/30 bg-white/15 px-3 py-2 text-sm text-white"><option className="text-slate-900" value={event.id}>{event.eventType}</option>{events.filter((item) => item.id !== event.id).map((item) => <option className="text-slate-900" key={item.id} value={item.id}>{item.eventType} · {item.weddingNumber}</option>)}</select>}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><div><CalendarDays className="mb-1 h-4 w-4 text-white/70" /><p className="text-xs text-white/70">Date</p><p className="font-semibold">{dateLabel(event.primaryDate)}</p></div><div><MapPin className="mb-1 h-4 w-4 text-white/70" /><p className="text-xs text-white/70">Location</p><p className="font-semibold">{event.city}</p></div><div><Users className="mb-1 h-4 w-4 text-white/70" /><p className="text-xs text-white/70">Guests</p><p className="font-semibold">{event.guestCount ?? '—'}</p></div><div><CheckCircle2 className="mb-1 h-4 w-4 text-white/70" /><p className="text-xs text-white/70">Status</p><p className="font-semibold capitalize">{event.status.toLowerCase()}</p></div></div>
          <p className="mt-5 text-sm text-white/85">Your Shaadi Shopping contact: <span className="font-semibold text-white">{event.coordinatorName || 'Your coordinator will be assigned soon'}</span></p>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Confirmed total</p><p className="mt-1 text-xl font-bold text-slate-900">{money(event.finance.total)}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Paid</p><p className="mt-1 text-xl font-bold text-emerald-600">{money(event.finance.paid)}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Pending</p><p className="mt-1 text-xl font-bold text-amber-600">{money(event.finance.pending)}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Next payment</p><p className="mt-1 text-xl font-bold text-slate-900">{event.finance.nextPayment ? money(event.finance.nextPayment.amount) : 'None'}</p></div></section>

        <Approvals approvals={approvalState[event.id] || []} onDecision={decideApproval} />

        <GuestRsvp weddingId={event.id} events={event.functions.map((fn) => ({ id: fn.id, type: fn.name, label: fn.name }))} initialGuests={event.guests} clientMode />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-lg font-bold text-slate-900">Functions</h2>{event.functions.length === 0 ? <p className="text-sm text-slate-500">Functions will appear here as your event plan is finalized.</p> : <div className="space-y-3">{event.functions.map((fn) => <div key={fn.id} className="rounded-xl bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><span className="font-semibold text-slate-900">{fn.name}</span><span className="text-xs font-medium text-slate-500">{fn.status}</span></div><p className="mt-1 text-sm text-slate-600">{dateLabel(fn.date)}{fn.startTime ? ` · ${fn.startTime}` : ''} · {fn.location}</p><p className="mt-2 text-xs text-slate-500">{fn.services.length ? fn.services.map((service) => service.name).join(', ') : 'Services being planned'}</p></div>)}</div>}</section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-lg font-bold text-slate-900">What&apos;s next</h2>{event.tasks.filter((task) => task.status !== 'DONE' && task.status !== 'CANCELLED').slice(0, 5).map((task) => <div key={task.id} className="mb-2 flex items-center justify-between rounded-xl bg-amber-50 p-3 text-sm"><span className="font-medium text-slate-700">{task.title}</span><span className="text-xs text-slate-500">{dateLabel(task.dueAt)}</span></div>)}{event.tasks.filter((task) => task.status !== 'DONE' && task.status !== 'CANCELLED').length === 0 && <p className="text-sm text-slate-500">No client actions are currently due.</p>}<div className="mt-5 border-t border-slate-100 pt-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Upcoming milestone</p><p className="font-medium text-slate-800">{event.timeline.find((item) => item.status !== 'DONE')?.label || 'Your timeline is up to date'}</p></div></section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-lg font-bold text-slate-900">Services & selections</h2>{event.services.length === 0 ? <p className="text-sm text-slate-500">No services have been assigned yet.</p> : <div className="grid gap-2 sm:grid-cols-2">{event.services.map((service, index) => <div key={`${service.name}-${service.functionName}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><div><p className="font-medium text-slate-800">{service.name}</p><p className="text-xs text-slate-500">{service.functionName} · {service.provider || 'Provider being finalized'}</p></div><span className="text-xs text-slate-500">{service.status.replaceAll('_', ' ')}</span></div>)}</div>}</section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">Finance</h2><CreditCard className="h-5 w-5 text-rose-500" /></div>{event.finance.invoices.length === 0 ? <p className="text-sm text-slate-500">Invoices will appear here when issued.</p> : <div className="space-y-3">{event.finance.invoices.map((invoice) => <div key={invoice.id} className="rounded-xl border border-slate-100 p-3"><div className="flex justify-between text-sm"><span className="font-semibold">{invoice.number}</span><span>{money(invoice.total)}</span></div><p className="mt-1 text-xs text-slate-500">Paid {money(invoice.paid)} · Pending {money(invoice.pending)}</p>{invoice.paymentUrl && <a href={invoice.paymentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center text-xs font-semibold text-rose-600">Pay securely <ChevronRight className="h-3 w-3" /></a>}</div>)}</div>}<h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Payment history</h3>{event.finance.payments.length ? event.finance.payments.map((payment) => <div key={payment.id} className="flex justify-between text-sm text-slate-600"><span>{payment.method} · {dateLabel(payment.paidAt)}</span><span className="font-medium text-emerald-700">{money(payment.amount)}</span></div>) : <p className="text-sm text-slate-500">No payments recorded yet.</p>}</section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-lg font-bold text-slate-900">Documents & event day</h2>{event.documents.length ? <div className="space-y-2">{event.documents.map((document) => <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-rose-600"><FileText className="h-4 w-4" />{document.fileName}<span className="ml-auto text-xs text-slate-400">{document.category}</span></a>)}</div> : <p className="text-sm text-slate-500">Client documents will appear here when shared.</p>}<div className="mt-5 border-t border-slate-100 pt-4"><p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Clock3 className="h-4 w-4 text-rose-500" />Event-day information</p><p className="mt-2 text-sm text-slate-500">Venue, timings, parking, accommodation, transport, and special instructions will appear here as they are added.</p></div></section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-lg font-bold text-slate-900">Client timeline</h2>{event.timeline.length ? <div className="grid gap-2 sm:grid-cols-2">{event.timeline.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm"><span className={item.status === 'DONE' ? 'text-emerald-500' : 'text-slate-300'}>●</span><span className={item.status === 'DONE' ? 'text-slate-400 line-through' : 'font-medium text-slate-700'}>{item.label}</span>{item.dueDate && <span className="ml-auto text-xs text-slate-500">{dateLabel(item.dueDate)}</span>}</div>)}</div> : <p className="text-sm text-slate-500">Your event timeline will appear here.</p>}</section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-lg font-bold text-slate-900">Recent updates</h2>{event.activity.length ? <div className="space-y-2">{event.activity.slice(0, 8).map((entry) => <div key={entry.id} className="flex justify-between gap-3 text-sm"><span className="text-slate-700">{entry.summary}</span><span className="shrink-0 text-xs text-slate-400">{dateLabel(entry.createdAt)}</span></div>)}</div> : <p className="text-sm text-slate-500">No client updates yet.</p>}</section>
      </div>
    </main>
  );
}
