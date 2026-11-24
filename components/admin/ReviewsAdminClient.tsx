'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Star } from 'lucide-react';
import { publicName, REVIEW_PAGE_URL } from '@/lib/reviews/platformReview';
import { SHAADI_PHONE } from '@/lib/shaadiContact';

// Admin → Reviews (24 Nov 2026): the review link + QR to share, and reviews of Shaadi Shopping waiting to be published.
// Publishing shows the first name + initial, stars and words on /review; the mobile and wedding ID stay here.

type Status = 'PENDING' | 'PUBLISHED' | 'HIDDEN';
type Row = { id: string; authorName: string; rating: number; comment: string | null; phone: string | null; weddingNumber: string | null; status: Status; createdAt: string; moderatedBy: { name: string | null } | null };

const TABS: { id: Status; label: string }[] = [
  { id: 'PENDING', label: 'Waiting' },
  { id: 'PUBLISHED', label: 'Published' },
  { id: 'HIDDEN', label: 'Hidden' },
];
const shareText = `Thank you for planning your wedding with Shaadi Shopping! We would love to hear how it went — it takes a minute: ${REVIEW_PAGE_URL}`;

export default function ReviewsAdminClient() {
  const [tab, setTab] = useState<Status>('PENDING');
  const [data, setData] = useState<{ reviews: Row[]; counts: Partial<Record<Status, number>> } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/reviews?status=${tab}`, { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success) setData(json.data);
    else setError(json?.error || 'Could not load reviews');
  }, [tab]);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    QRCode.toDataURL(REVIEW_PAGE_URL, { width: 1024, margin: 2, color: { dark: '#221714', light: '#FFFFFF' } }).then(setQr).catch(() => setQr(null));
  }, []);

  const moderate = async (id: string, status: Status) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not save');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold">Reviews of Shaadi Shopping</h1>

      <section aria-labelledby="share" className="grid gap-5 rounded-2xl border border-gray-200 bg-white p-5 sm:grid-cols-[200px_minmax(0,1fr)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated QR data URL */}
        {qr ? <img src={qr} alt={`QR code for ${REVIEW_PAGE_URL}`} className="h-[200px] w-[200px] rounded-lg border border-gray-100" /> : <div className="h-[200px] w-[200px] rounded-lg bg-gray-100" />}
        <div className="min-w-0 space-y-3">
          <h2 id="share" className="font-semibold">Ask families for a review</h2>
          <p className="break-all rounded-lg bg-gray-50 px-3 py-2 font-mono text-sm">{REVIEW_PAGE_URL}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void navigator.clipboard.writeText(REVIEW_PAGE_URL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-semibold"><Copy className="h-4 w-4" aria-hidden />{copied ? 'Copied' : 'Copy link'}</button>
            {qr && <a href={qr} download="shaadi-shopping-review-qr.png" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-semibold"><Download className="h-4 w-4" aria-hidden />Download QR (PNG)</a>}
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg bg-[#1F7A4D] px-3 text-sm font-semibold text-white">Share on WhatsApp</a>
          </div>
          <p className="text-xs text-gray-500">Reviews appear on the page only after you publish them. Questions from families go to {SHAADI_PHONE}.</p>
        </div>
      </section>

      <section aria-labelledby="list" className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 id="list" className="sr-only">Reviews</h2>
        <div role="tablist" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${tab === t.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>
              {t.label} {data?.counts[t.id] ? `(${data.counts[t.id]})` : ''}
            </button>
          ))}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        {!data ? (
          <p className="mt-4 text-sm text-gray-500">Loading…</p>
        ) : data.reviews.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{tab === 'PENDING' ? 'No reviews waiting.' : 'None yet.'}</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {data.reviews.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{r.authorName} <span className="text-sm font-normal text-gray-500">· shown as “{publicName(r.authorName)}”</span></p>
                  <span className="inline-flex gap-0.5" role="img" aria-label={`${r.rating} out of 5`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} aria-hidden />)}</span>
                </div>
                {r.comment && <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{r.comment}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  {new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}
                  {r.phone && ` · +91 ${r.phone}`}
                  {r.weddingNumber && ` · ${r.weddingNumber}`}
                  {r.moderatedBy?.name && ` · ${r.status === 'PUBLISHED' ? 'published' : 'moved'} by ${r.moderatedBy.name}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.status !== 'PUBLISHED' && <button type="button" disabled={busy === r.id} onClick={() => void moderate(r.id, 'PUBLISHED')} className="min-h-11 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-40">Publish</button>}
                  {r.status !== 'HIDDEN' && <button type="button" disabled={busy === r.id} onClick={() => void moderate(r.id, 'HIDDEN')} className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm font-semibold disabled:opacity-40">Hide</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
