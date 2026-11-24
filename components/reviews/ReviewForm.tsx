'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { COMMENT_MAX, NAME_MAX, checkPlatformReview } from '@/lib/reviews/platformReview';

// The form on /review (24 Nov 2026). Sends to /api/reviews; the review waits for our team before it is shown.

const WORDS = ['', 'Poor', 'Could be better', 'Good', 'Very good', 'Excellent'];
const field = 'min-h-12 w-full rounded-xl border border-[#E8DCC8] bg-[#FFFCF7] px-3.5 text-base outline-none focus:border-[#C5A46D] focus:ring-2 focus:ring-[#C5A46D]/25';

export default function ReviewForm() {
  const [f, setF] = useState({ authorName: '', rating: 0, comment: '', phone: '', weddingNumber: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div role="status" className="mt-6 rounded-2xl bg-[#F3EBDD] p-5 text-[#4D3E36]">
        <p className="text-lg font-semibold text-[#7A1238]">Thank you, {f.authorName.split(' ')[0]}!</p>
        <p className="mt-1 text-sm">Your review has reached our team. It will appear on this page once they have read it.</p>
        <a href="#next" className="mt-3 inline-flex min-h-11 items-center font-semibold text-[#7A1238] underline underline-offset-4">This is not goodbye — plan your next celebration with us ↓</a>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const checked = checkPlatformReview(f);
    if (!checked.ok) return setError(checked.error);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not send. Please try again.');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 grid gap-4" noValidate>
      <fieldset>
        <legend className="text-sm font-semibold">Your rating</legend>
        <div className="mt-1.5 flex items-center gap-1" role="radiogroup" aria-label="Your rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={f.rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setF({ ...f, rating: n })} className="flex h-12 w-12 items-center justify-center rounded-xl hover:bg-[#F3EBDD]">
              <Star className={`h-8 w-8 ${n <= f.rating ? 'fill-[#C5A46D] text-[#C5A46D]' : 'text-[#D9C8AC]'}`} aria-hidden />
            </button>
          ))}
          <span className="ml-2 text-sm font-semibold text-[#7A1238]">{WORDS[f.rating]}</span>
        </div>
      </fieldset>
      <label className="grid gap-1 text-sm font-semibold">Your name
        <input value={f.authorName} maxLength={NAME_MAX} autoComplete="name" onChange={(e) => setF({ ...f, authorName: e.target.value })} className={field} />
      </label>
      <label className="grid gap-1 text-sm font-semibold">Your review <span className="font-normal text-[#8A7A70]">(optional)</span>
        <textarea value={f.comment} maxLength={COMMENT_MAX} rows={5} onChange={(e) => setF({ ...f, comment: e.target.value })} placeholder="How was planning with your Wedding Expert? How did the day go?" className={`${field} py-3`} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">Mobile <span className="font-normal text-[#8A7A70]">(optional, never shown)</span>
          <input value={f.phone} inputMode="tel" autoComplete="tel" onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="10-digit mobile" className={field} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">Wedding ID <span className="font-normal text-[#8A7A70]">(optional, never shown)</span>
          <input value={f.weddingNumber} onChange={(e) => setF({ ...f, weddingNumber: e.target.value })} placeholder="WED-2026-0002" className={field} />
        </label>
      </div>
      {/* Hidden from people; bots fill it. */}
      <input aria-hidden="true" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} name="website" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      {error && <p role="alert" className="text-sm text-[#B42318]">{error}</p>}
      <button type="submit" disabled={busy} className="min-h-12 rounded-full bg-[#7A1238] px-6 text-base font-semibold text-white hover:bg-[#5E0D2B] disabled:opacity-50">{busy ? 'Sending…' : 'Send my review'}</button>
    </form>
  );
}
