'use client';

import { useCallback, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import type { StaffReview } from '@/services/review.service';
import { dateWords } from '@/lib/wedding/controlRoom';

// Roadmap 1.4 (08-quotation.md §19) — after a wedding is completed: ask the couple for reviews, then publish or hide each one. Only
// published reviews appear on the vendor's public page ("Reviews from Shaadi Shopping couples"); they never change the vendor's
// hand-entered online rating.

const STATUS: Record<StaffReview['status'], { label: string; chip: string }> = {
  PENDING: { label: 'Waiting for you', chip: 'bg-amber-100 text-amber-800' },
  PUBLISHED: { label: 'Published', chip: 'bg-emerald-100 text-emerald-800' },
  HIDDEN: { label: 'Hidden', chip: 'bg-gray-100 text-gray-600' },
};

export function reviewRequestMessage(coupleName: string | null): string {
  return [
    `Namaste${coupleName ? ` ${coupleName}` : ''}! Congratulations once again — it was a joy to be part of your wedding.`,
    'Could you take a minute to review your vendors? Open the Shaadi Shopping link we sent you for your proposal and tap “Reviews”.',
    'Your words help other couples choose with confidence. Thank you!',
  ].join('\n\n');
}

export default function WeddingReviews({ weddingId, coupleName }: { weddingId: string; coupleName: string | null }) {
  const [rows, setRows] = useState<StaffReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/weddings/${weddingId}/reviews`);
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error ?? 'Could not load reviews');
      setRows(body.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load reviews');
    }
  }, [weddingId]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const moderate = async (id: string, status: 'PUBLISHED' | 'HIDDEN') => {
    setBusy(id);
    try {
      const res = await fetch(`/api/weddings/${weddingId}/reviews/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error ?? 'Could not save');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    }
    setBusy(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reviewRequestMessage(coupleName));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const pending = rows?.filter((r) => r.status === 'PENDING').length ?? 0;

  return (
    <section aria-label="Reviews" className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Reviews{pending > 0 ? ` · ${pending} to check` : ''}</h2>
          <p className="mt-1 text-sm text-gray-700">
            The couple can review each vendor they booked from their proposal link. Nothing is public until you publish it.
          </p>
        </div>
        <button type="button" onClick={copy} className="min-h-10 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          {copied ? 'Message copied' : 'Copy WhatsApp message asking for reviews'}
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">The message points to the link they already have. If they lost it, create a new one from the quotation in the CRM (the old one stops working).</p>

      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      {rows && rows.length === 0 && <p className="mt-3 text-sm text-gray-500">No reviews yet.</p>}
      {rows && rows.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-gray-100 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{r.vendorName} <span className="font-normal text-gray-500">· {r.category}{r.functionLabel ? ` · ${r.functionLabel}` : ''}</span></p>
                  <p className="mt-0.5 flex items-center gap-1" aria-label={`${r.rating} of 5 stars`}>
                    {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} aria-hidden />)}
                    <span className="ml-1 text-xs text-gray-500">by {r.authorName} · {dateWords(r.submittedAt)}</span>
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[r.status].chip}`}>{STATUS[r.status].label}</span>
              </div>
              {r.comment && <p className="mt-2 whitespace-pre-line text-gray-700">“{r.comment}”</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {r.status !== 'PUBLISHED' && (
                  <button type="button" disabled={busy === r.id} onClick={() => moderate(r.id, 'PUBLISHED')} className="min-h-9 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Publish on vendor page</button>
                )}
                {r.status !== 'HIDDEN' && (
                  <button type="button" disabled={busy === r.id} onClick={() => moderate(r.id, 'HIDDEN')} className="min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40">Hide</button>
                )}
                {r.moderatedAt && <span className="text-xs text-gray-400">{STATUS[r.status].label} {dateWords(r.moderatedAt)}{r.moderatedByName ? ` by ${r.moderatedByName}` : ''}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
