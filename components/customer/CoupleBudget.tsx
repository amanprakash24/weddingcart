'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import type { ClientPortalEvent } from '@/services/clientPortal.service';
import { COUPLE_BUDGET_CATEGORIES, checkExpense } from '@/lib/wedding/coupleBudget';

// My Wedding → Budget (25 Nov 2026). The couple's own total and plan per category; spending fills itself from what is booked with us
// (agreed / paid — read-only here) and their own vendors' prices, and they add their own expenses. Money permission only.

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const field = 'min-h-11 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 text-base';
const amountOf = (s: string) => (s.trim() === '' ? '' : s.replace(/[,\s₹]/g, ''));
type ExpenseForm = { id: string | null; category: string; title: string; amount: string; paid: string; spentOn: string; notes: string };
const blank: ExpenseForm = { id: null, category: 'OUTFITS', title: '', amount: '', paid: '', spentOn: '', notes: '' };

export default function CoupleBudget({ event, bookedWith }: { event: ClientPortalEvent; bookedWith: string }) {
  const router = useRouter();
  const b = event.coupleBudget;
  const base = `/api/customer/weddings/${event.id}/budget`;
  const canEdit = event.status !== 'CANCELLED';
  const [totalText, setTotalText] = useState<string | null>(null);
  const [planning, setPlanning] = useState<{ category: string; planned: string } | null>(null);
  const [form, setForm] = useState<ExpenseForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!b) return null;
  const s = b.summary;

  const call = async (url: string, method: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not save. Please try again.');
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveExpense = async () => {
    if (!form) return;
    const body = { category: form.category, title: form.title, amount: amountOf(form.amount), paid: amountOf(form.paid) || 0, spentOn: form.spentOn, notes: form.notes };
    const c = checkExpense(body);
    if (!c.ok) return setError(c.error);
    if (await call(form.id ? `${base}/expenses/${form.id}` : `${base}/expenses`, form.id ? 'PATCH' : 'POST', body)) setForm(null);
  };

  const used = s.total ? Math.min(100, Math.round((s.committed / s.total) * 100)) : 0;
  const over = s.left !== null && s.left < 0;

  return (
    <section id="budget" aria-labelledby="c-budget" className="os-glass scroll-mt-4 rounded-[22px] border bg-white p-5 sm:p-6">
      <h2 id="c-budget" className="flex items-center gap-2 text-[17px] font-bold"><Wallet className="h-5 w-5 text-[#15803D]" aria-hidden />Your budget</h2>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">Your own planner. What you booked with {bookedWith} fills in by itself; add everything else you spend.</p>

      {/* Total */}
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/70 bg-white/60 p-3.5 sm:col-span-1">
          <p className="text-xs text-[var(--color-text-muted)]">Your budget</p>
          {totalText === null ? (
            <p className="flex items-center gap-1.5 text-lg font-bold">{s.total === null ? <span className="text-sm font-semibold text-[var(--color-text-muted)]">Not set</span> : inr(s.total)}
              {canEdit && <button type="button" aria-label="Change your budget" onClick={() => setTotalText(s.total === null ? '' : String(s.total))} className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-[var(--color-primary-text)]"><Pencil className="h-4 w-4" aria-hidden /></button>}
            </p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); void call(base, 'PATCH', { total: amountOf(totalText) }).then((ok) => ok && setTotalText(null)); }} className="mt-1 grid gap-2">
              <input aria-label="Your total budget" inputMode="numeric" value={totalText} onChange={(e) => setTotalText(e.target.value)} placeholder="e.g. 800000" className={field} />
              <div className="flex gap-2"><button type="submit" disabled={busy} className="min-h-10 rounded-lg bg-[var(--primary)] px-3 text-sm font-bold text-white">Save</button><button type="button" onClick={() => setTotalText(null)} className="min-h-10 px-2 text-sm">Cancel</button></div>
            </form>
          )}
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/60 p-3.5"><p className="text-xs text-[var(--color-text-muted)]">Agreed / spent</p><p className="text-lg font-bold">{inr(s.committed)}</p></div>
        <div className="rounded-2xl border border-white/70 bg-white/60 p-3.5"><p className="text-xs text-[var(--color-text-muted)]">Paid so far</p><p className="text-lg font-bold">{inr(s.paid)}</p></div>
        <div className={`rounded-2xl border p-3.5 ${over ? 'border-[#FCA5A5] bg-[#FEF2F2]' : 'border-white/70 bg-white/60'}`}><p className="text-xs text-[var(--color-text-muted)]">{over ? 'Over budget' : 'Left'}</p><p className={`text-lg font-bold ${over ? 'text-[#B42318]' : ''}`}>{s.left === null ? '—' : inr(Math.abs(s.left))}</p></div>
      </div>
      {s.total !== null && s.total > 0 && <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={100} aria-label="Budget used"><div className={`h-full rounded-full ${over ? 'bg-[#B42318]' : 'bg-[var(--primary)]'}`} style={{ width: `${used}%` }} /></div>}

      {/* Where it goes */}
      <ul className="mt-4 divide-y divide-white/70 rounded-2xl border border-white/70 bg-white/55 text-sm">
        <li className="flex flex-wrap justify-between gap-2 px-3.5 py-2.5"><span>Booked with {bookedWith} <span className="text-xs text-[var(--color-text-muted)]">· from your quotation, paid {inr(event.money.received)}</span></span><b>{inr(s.parts.booked)}</b></li>
        <li className="flex flex-wrap justify-between gap-2 px-3.5 py-2.5"><span>Your own vendors <span className="text-xs text-[var(--color-text-muted)]">· prices you added in Vendors</span></span><b>{inr(s.parts.ownVendors)}</b></li>
        <li className="flex flex-wrap justify-between gap-2 px-3.5 py-2.5"><span>Your own expenses</span><b>{inr(s.parts.expenses)}</b></li>
      </ul>

      {/* Plan by category */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-primary-text)]">Plan by category</h3>
        {canEdit && !planning && <button type="button" onClick={() => { setError(null); setPlanning({ category: 'OUTFITS', planned: '' }); }} className="min-h-11 text-sm font-semibold text-[var(--color-primary-text)]">+ Plan a category</button>}
      </div>
      {planning && (
        <form onSubmit={(e) => { e.preventDefault(); void call(base, 'PATCH', { category: planning.category, planned: amountOf(planning.planned) }).then((ok) => ok && setPlanning(null)); }} className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2 rounded-2xl border border-white/70 bg-white/60 p-3 sm:grid-cols-[1fr_1fr_auto]">
          <select aria-label="Category" value={planning.category} onChange={(e) => setPlanning({ ...planning, category: e.target.value })} className={field}>{COUPLE_BUDGET_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          <input aria-label="Planned amount" inputMode="numeric" value={planning.planned} onChange={(e) => setPlanning({ ...planning, planned: e.target.value })} placeholder="Planned ₹ (empty removes)" className={field} />
          <div className="flex gap-2"><button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white">Save</button><button type="button" onClick={() => setPlanning(null)} className="min-h-11 px-2 text-sm">Cancel</button></div>
        </form>
      )}
      {s.categories.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Plan how much to spend on outfits, jewellery, gifts and more.</p>
      ) : (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {s.categories.map((c) => {
            const pct = c.planned ? Math.min(100, Math.round((c.spent / c.planned) * 100)) : 0;
            const overCat = c.planned !== null && c.spent > c.planned;
            return (
              <li key={c.category} className="rounded-2xl border border-white/70 bg-white/55 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-1"><b className="text-sm">{c.label}</b><span className={`text-sm ${overCat ? 'font-bold text-[#B42318]' : 'text-[var(--color-text-secondary)]'}`}>{inr(c.spent)}{c.planned !== null && ` of ${inr(c.planned)}`}</span></div>
                {c.planned !== null && <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/80"><div className={`h-full rounded-full ${overCat ? 'bg-[#B42318]' : 'bg-[var(--primary)]'}`} style={{ width: `${pct}%` }} /></div>}
              </li>
            );
          })}
        </ul>
      )}

      {/* Own expenses */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-primary-text)]">Your expenses</h3>
        {canEdit && !form && <button type="button" onClick={() => { setError(null); setForm(blank); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" aria-hidden />Add an expense</button>}
      </div>
      {form && (
        <form onSubmit={(e) => { e.preventDefault(); void saveExpense(); }} className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border border-white/70 bg-white/60 p-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">What for
            <input aria-label="Expense" value={form.title} maxLength={100} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Bridal lehenga" className={field} />
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Category
            <select aria-label="Expense category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={field}>{COUPLE_BUDGET_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Amount ₹
            <input aria-label="Amount" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={field} />
          </label>
          <label className="grid gap-1 text-sm text-[var(--color-text-secondary)]">Paid so far ₹ <span className="text-xs text-[var(--color-text-muted)]">(optional)</span>
            <input aria-label="Paid so far" inputMode="numeric" value={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.value })} className={field} />
          </label>
          {error && <p role="alert" className="text-sm text-[#B42318] sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => { setForm(null); setError(null); }} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-[var(--color-text-secondary)]">Cancel</button>
          </div>
        </form>
      )}
      {b.records.expenses.length === 0 ? (
        !form && <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Add shopping, jewellery, gifts — anything you pay for yourselves.</p>
      ) : (
        <ul className="mt-2 divide-y divide-white/70 rounded-2xl border border-white/70 bg-white/55">
          {b.records.expenses.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="font-semibold">{x.title} <span className="text-xs font-normal text-[var(--color-text-muted)]">· {x.categoryLabel}</span></p>
                <p className="text-xs text-[var(--color-text-muted)]">{inr(x.amount)}{x.paid > 0 && ` · paid ${inr(x.paid)}`}{x.paid >= x.amount && ' · fully paid'}</p>
              </div>
              {canEdit && !form && (
                <span className="flex">
                  <button type="button" aria-label={`Change ${x.title}`} onClick={() => { setError(null); setForm({ id: x.id, category: x.category, title: x.title, amount: String(x.amount), paid: x.paid ? String(x.paid) : '', spentOn: x.spentOn ?? '', notes: x.notes ?? '' }); }} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-primary-text)]"><Pencil className="h-4 w-4" aria-hidden /></button>
                  <button type="button" aria-label={`Remove ${x.title}`} disabled={busy} onClick={() => void call(`${base}/expenses/${x.id}`, 'DELETE')} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[#B42318]"><Trash2 className="h-4 w-4" aria-hidden /></button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && !form && <p role="alert" className="mt-2 text-sm text-[#B42318]">{error}</p>}
    </section>
  );
}
