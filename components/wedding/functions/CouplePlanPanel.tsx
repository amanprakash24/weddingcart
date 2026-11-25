'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChecklistItemView, BudgetRecords } from '@/services/coupleChecklistBudget.service';

// The couple's own checklist and budget, as the team sees them on the wedding page (25 Nov 2026) — read-only: the team advises,
// the couple decides. What is booked with us is in Finance, not repeated here.

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const dayWords = (ymd: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${ymd}T00:00:00Z`));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

export default function CouplePlanPanel({ weddingId }: { weddingId: string }) {
  const [data, setData] = useState<{ checklist: ChecklistItemView[]; budget: BudgetRecords } | null>(null);
  const load = useCallback(async () => {
    const res = await fetch(`/api/weddings/${weddingId}/couple-plan`, { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success) setData(json.data);
  }, [weddingId]);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);
  if (!data) return null;
  const { checklist, budget } = data;
  const done = checklist.filter((i) => i.done).length;
  const t = today();
  const overdue = checklist.filter((i) => !i.done && i.dueDate && i.dueDate < t);
  const next = checklist.filter((i) => !i.done && i.dueDate && i.dueDate >= t).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)).slice(0, 3);
  const expenses = budget.expenses.reduce((s, e) => s + e.amount, 0);
  if (!checklist.length && budget.total === null && !budget.expenses.length) return null;
  return (
    <section aria-labelledby="couple-plan" className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 id="couple-plan" className="font-semibold">The couple’s own plan <span className="text-xs font-normal text-gray-500">· read-only, from My Wedding</span></h3>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm"><b>Checklist:</b> {done} of {checklist.length} done{overdue.length > 0 && <span className="text-red-700"> · {overdue.length} overdue</span>}</p>
          <ul className="mt-1 space-y-0.5 text-sm text-gray-700">
            {[...overdue.slice(0, 3), ...next].slice(0, 4).map((i) => <li key={i.id}>{i.dueDate && i.dueDate < t ? '⚠ ' : '• '}{i.title} <span className="text-xs text-gray-500">by {dayWords(i.dueDate!)}</span></li>)}
          </ul>
        </div>
        <div className="text-sm">
          <p><b>Their budget:</b> {budget.total === null ? 'not set' : inr(budget.total)}</p>
          <p className="text-gray-700">Their own expenses: {inr(expenses)} ({budget.expenses.length})</p>
          {budget.planned.length > 0 && <p className="text-gray-700">Planned categories: {budget.planned.length}</p>}
          <p className="mt-1 text-xs text-gray-500">Plus what is booked with us (Finance) and their own vendors’ prices.</p>
        </div>
      </div>
    </section>
  );
}
