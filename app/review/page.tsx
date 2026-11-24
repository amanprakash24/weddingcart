import type { Metadata } from 'next';
import Image from 'next/image';
import { Star } from 'lucide-react';
import ReviewForm from '@/components/reviews/ReviewForm';
import { platformReviewService } from '@/services/platformReview.service';

// Review Shaadi Shopping (24 Nov 2026) — the page behind the review link and QR. Couples and families tell us how their wedding
// went; nothing is shown until our team publishes it. Refreshed when staff publish or hide a review (revalidatePath) and every 10 min.
export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Review Shaadi Shopping — Tell us about your wedding',
  description: 'Planned your wedding with Shaadi Shopping? Tell us how it went. Read what couples and families in Patna say about their Wedding Expert.',
  alternates: { canonical: '/review' },
  openGraph: { title: 'Review Shaadi Shopping', description: 'Tell us how your wedding went with Shaadi Shopping.', url: '/review', type: 'website' },
};

const serif = { fontFamily: 'var(--font-playfair), serif' };
const script = { fontFamily: 'var(--font-cormorant), Georgia, serif' };

function Stars({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`${size} ${n <= Math.round(value) ? 'fill-[#C5A46D] text-[#C5A46D]' : 'text-[#E2D3BC]'}`} aria-hidden />)}
    </span>
  );
}

export default async function ReviewPage() {
  // If reviews cannot be read (the database is briefly unreachable), the form still works and the list fills on the next refresh.
  const { summary, reviews } = await platformReviewService.published().catch((err) => {
    console.error('review page: could not read published reviews', err);
    return { summary: null, reviews: [] };
  });
  return (
    <main className="bg-[#FBF7F1] pt-16 text-[#221714]">
      <section className="relative isolate overflow-hidden bg-[#2A0F18]">
        <Image src="/cat-real-weddings.jpg" alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-40" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-[#2A0F18]/40 via-[#2A0F18]/70 to-[#2A0F18]" />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-white sm:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#E7CFA0]">Your words matter to us</p>
          <h1 className="mt-4 text-4xl leading-tight sm:text-5xl" style={serif}>How was your wedding with <span className="text-[#E7CFA0]" style={script}>Shaadi Shopping</span>?</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/80 sm:text-lg">Every wedding we plan is someone’s once-in-a-lifetime day. Tell us what went well — and what we can do better.</p>
          {summary && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm">
              <Stars value={summary.average} /> <b>{summary.average.toFixed(1)}</b> from {summary.count} {summary.count === 1 ? 'family' : 'families'}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:py-16">
        <section aria-labelledby="write" className="rounded-[26px] border border-[#E8DCC8] bg-white p-5 shadow-sm sm:p-8">
          <h2 id="write" className="text-2xl" style={serif}>Write your review</h2>
          <p className="mt-1 text-sm text-[#6B5A50]">It appears here after our team reads it. Only your first name and initial are shown.</p>
          <ReviewForm />
        </section>

        <section aria-labelledby="said">
          <h2 id="said" className="text-2xl" style={serif}>What families say</h2>
          {reviews.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-[#E2D3BC] bg-white/60 p-5 text-sm text-[#6B5A50]">Be the first to share how your wedding went.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-2xl border border-[#E8DCC8] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b>{r.name}</b>
                    <Stars value={r.rating} />
                  </div>
                  {r.comment && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#4D3E36]">{r.comment}</p>}
                  <p className="mt-2 text-xs text-[#8A7A70]">{r.month}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
