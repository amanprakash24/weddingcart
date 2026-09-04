'use client';

import { useState } from 'react';
import type { WorkspaceWeddingEvent } from './types';

type Approval = {
  id: string;
  subjectType: string;
  title: string | null;
  description: string | null;
  amount: number | null;
  deadline: string | null;
  status: string;
  clientComment: string | null;
  weddingEvent: { id: string; label: string | null; type: string } | null;
};

const TYPES = ['SERVICE_SELECTION', 'DECORATION', 'MENU', 'DESIGN', 'QUOTATION', 'OTHER'];

export default function Approvals({ weddingId, events, approvals, onChange }: { weddingId: string; events: WorkspaceWeddingEvent[]; approvals: Approval[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subjectType: 'SERVICE_SELECTION', title: '', description: '', amount: '', deadline: '', weddingEventId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/weddings/${weddingId}/approvals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: form.amount || undefined, deadline: form.deadline || undefined, weddingEventId: form.weddingEventId || undefined }) });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Could not create approval');
      setForm({ subjectType: 'SERVICE_SELECTION', title: '', description: '', amount: '', deadline: '', weddingEventId: '' });
      setOpen(false);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create approval');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold text-gray-900">Approvals</h2><button onClick={() => setOpen((value) => !value)} className="text-sm font-medium text-rose-600">{open ? 'Close' : '+ Request approval'}</button></div>
      {open && <form onSubmit={create} className="mb-4 space-y-2 rounded-xl border border-dashed border-gray-200 p-3"><div className="grid gap-2 sm:grid-cols-2"><select value={form.subjectType} onChange={(e) => setForm({ ...form, subjectType: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-2 text-sm">{TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select><select value={form.weddingEventId} onChange={(e) => setForm({ ...form, weddingEventId: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-2 text-sm"><option value="">All functions</option>{events.map((item) => <option key={item.id} value={item.id}>{item.label || item.type}</option>)}</select></div><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Approval title" className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm" /><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What should the client review?" className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm" rows={2} /><div className="grid gap-2 sm:grid-cols-2"><input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount (optional)" className="rounded-lg border border-gray-200 px-2 py-2 text-sm" /><input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-2 text-sm" /></div>{error && <p className="text-xs text-red-600">{error}</p>}<button disabled={saving} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Sending…' : 'Send for client approval'}</button></form>}
      {approvals.length === 0 ? <p className="text-sm text-gray-500">No approval requests yet.</p> : <div className="space-y-2">{approvals.map((approval) => <div key={approval.id} className="rounded-xl border border-gray-100 p-3"><div className="flex items-center justify-between gap-3"><span className="font-medium text-gray-900">{approval.title || 'Approval request'}</span><span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600">{approval.status.replaceAll('_', ' ')}</span></div><p className="mt-1 text-xs text-gray-500">{approval.weddingEvent?.label || approval.weddingEvent?.type || 'Event'} · {approval.subjectType.replaceAll('_', ' ')}{approval.amount !== null ? ` · ₹${approval.amount.toLocaleString('en-IN')}` : ''}</p>{approval.clientComment && <p className="mt-2 text-xs text-amber-700">Client: {approval.clientComment}</p>} {approval.status !== 'APPROVED' && approval.status !== 'CANCELLED' && <button onClick={async () => { await fetch(`/api/weddings/${weddingId}/approvals/${approval.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CANCELLED' }) }); onChange(); }} className="mt-2 text-xs text-red-600 hover:underline">Cancel request</button>}</div>)}</div>}
    </div>
  );
}
