'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { RATING_WORDS, type ProposalReviews } from '@/lib/reviews/reviewView';

// Roadmap 1.4 (docs/wedding-os/08-quotation.md §19) — after the wedding, the couple reviews each vendor they booked. One review per
// booking; it appears on the vendor's page only after the Shaadi Shopping team publishes it, and can be changed until then.

const serif = { fontFamily: 'var(--font-playfair), serif' };
const field =
  'w-full rounded-xl border border-[#E8DCC8] bg-[#FFFCF7] px-3.5 text-sm outline-none focus:border-[#C5A46D] focus:ring-2 focus:ring-[#C5A46D]/25';
type Item = ProposalReviews['items'][number];

function Stars({ value, onChange, label }: { value: number; onChange?: (n: number) => void; label: string }) {
  return (
    <div role={onChange ? 'radiogroup' : 'img'} aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'star' : 'stars'} — ${RATING_WORDS[n]}`}
            onClick={() => onChange(n)}
            className="rounded-md p-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A46D]"
          >
            <Star className={`h-7 w-7 ${n <= value ? 'fill-[#C5A46D] text-[#C5A46D]' : 'text-[#D9C9AE]'}`} aria-hidden />
          </button>
        ) : (
          <Star key={n} className={`h-4 w-4 ${n <= value ? 'fill-[#C5A46D] text-[#C5A46D]' : 'text-[#D9C9AE]'}`} aria-hidden />
        )
      )}
    </div>
  );
}

function ReviewCard({ token, item, defaultName, onSaved }: { token: string; item: Item; defaultName: string; onSaved: (next: ProposalReviews | null) => void }) {
  const editable = !item.review || item.review.status === 'PENDING';
  const [editing, setEditing] = useState(!item.review);
  const [rating, setRating] = useState(item.review?.rating ?? 0);
  const [comment, setComment] = useState(item.review?.comment ?? '');
  const [name, setName] = useState(item.review?.authorName ?? defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (busy || rating < 1) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposal/${token}/reviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookingId: item.bookingId, rating, comment, authorName: name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) setError(json.error ?? 'Something went wrong — please try again');
      else {
        setEditing(false);
        onSaved(json.data.reviews);
      }
    } catch {
      setError('Could not reach us — please check your connection and try again');
    }
    setBusy(false);
  }

  return (
    <section className="rounded-[24px] border border-[#E8DCC8] bg-white p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#B08D55]">
        {item.category} · {item.functionLabel}
      </p>
      <h3 className="mt-1 text-2xl text-[#2A1F1B]" style={serif}>
        {item.vendorName}
      </h3>

      {item.review && !editing ? (
        <div className="mt-3 space-y-2 text-sm text-[#4A3F38]">
          <Stars value={item.review.rating} label={`Your rating: ${item.review.rating} of 5`} />
          {item.review.comment && <p className="whitespace-pre-line">“{item.review.comment}”</p>}
          <p className="text-xs text-[#9A8676]">— {item.review.authorName}</p>
          <p className={`rounded-xl p-3 text-sm ${item.review.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-900' : 'bg-[#FFFAF5] text-[#5A4A40]'}`}>
            {item.review.status === 'PUBLISHED'
              ? 'Thank you! Your review is on their Shaadi Shopping page.'
              : item.review.status === 'PENDING'
                ? 'Thank you! Our team will publish it after a quick check. You can still change it until then.'
                : 'Thank you for your review.'}
          </p>
          {editable && (
            <button type="button" onClick={() => setEditing(true)} className="text-sm font-medium text-[#8B1A4A] underline decoration-[#C5A46D] underline-offset-4">
              Change my review
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <Stars value={rating} onChange={setRating} label={`Rate ${item.vendorName}`} />
            <p className="mt-1 h-4 text-xs text-[#9A8676]">{rating ? RATING_WORDS[rating] : 'Tap a star'}</p>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={3}
            aria-label={`Your review of ${item.vendorName} (optional)`}
            placeholder="What did you love? What could have been better? (optional)"
            className={`${field} py-3`}
          />
          <label className="grid gap-1.5 text-sm text-[#5A4A40]">
            Name to show with your review
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Name to show with your review" className={`${field} min-h-[48px]`} />
          </label>
          <button
            type="button"
            onClick={send}
            disabled={busy || rating < 1 || name.trim().length < 2}
            className="min-h-[52px] w-full rounded-full bg-gradient-to-r from-[#8B1A4A] via-[#9E2A55] to-[#C5A46D] px-6 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? 'Sending…' : item.review ? 'Update my review' : 'Send my review'}
          </button>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default function ReviewsPanel({ token, initial }: { token: string; initial: ProposalReviews }) {
  const [reviews, setReviews] = useState(initial);
  const left = reviews.items.filter((i) => !i.review).length;
  return (
    <div role="tabpanel" aria-label="Reviews" className="space-y-6 print:hidden">
      <section className="rounded-[24px] bg-gradient-to-br from-[#2A0614] to-[#5A0F2E] p-6 text-white sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#E8C98A]">Thank you for celebrating with us</p>
        <h2 className="mt-3 text-3xl" style={serif}>
          How was your wedding?
        </h2>
        <p className="mt-2 text-sm text-white/80">
          Your review helps other couples choose with confidence. {left > 0 ? `${left} of ${reviews.items.length} ${reviews.items.length === 1 ? 'vendor' : 'vendors'} still to review.` : 'You have reviewed every vendor — thank you!'}
        </p>
      </section>
      {reviews.items.map((item) => (
        <ReviewCard key={item.bookingId} token={token} item={item} defaultName={reviews.defaultName} onSaved={(next) => next && setReviews(next)} />
      ))}
    </div>
  );
}
