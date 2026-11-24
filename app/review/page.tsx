import type { Metadata } from 'next';
import Image from 'next/image';
import { Gift, Star } from 'lucide-react';
import Home3D from '@/components/home/Home3D';
import ReviewForm from '@/components/reviews/ReviewForm';
import NextCelebration from '@/components/reviews/NextCelebration';
import { RETURNING_OFFER } from '@/lib/reviews/nextEvent';
import { platformReviewService } from '@/services/platformReview.service';

// Review Shaadi Shopping (24 Nov 2026) — the page behind the review link and QR, in the homepage's 3D language (components/home/Home3D:
// sections swing in as they scroll, cards lean to the pointer, the hero arch turns in depth). Then "This is not goodbye": the next
// celebration and referrals. Nothing written here is shown until our team publishes it. Refreshed on publish and every 10 min.
export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Review Shaadi Shopping — Tell us about your wedding',
  description: 'Planned your wedding with Shaadi Shopping? Tell us how it went — and plan your next celebration with us. Read what families in Patna say.',
  alternates: { canonical: '/review' },
  openGraph: { title: 'Review Shaadi Shopping', description: 'Tell us how your wedding went — and welcome back for your next celebration.', url: '/review', type: 'website' },
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
  const latest = reviews.find((r) => r.comment) ?? null;
  return (
    <main className="overflow-x-clip bg-[#FBF7F1] pt-16 text-[#221714]">
      <Home3D />

      {/* Hero: words on the left, a 3D arch of a real wedding on the right */}
      <section aria-labelledby="review-title" className="relative isolate overflow-hidden bg-gradient-to-b from-[#2A0F18] via-[#3B1322] to-[#2A0F18] text-white">
        <div aria-hidden className="absolute -left-32 top-10 -z-10 h-96 w-96 rounded-full bg-[#7A1238] opacity-40 blur-3xl" />
        <div aria-hidden className="absolute -right-24 bottom-0 -z-10 h-80 w-80 rounded-full bg-[#C5A46D] opacity-20 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:py-20">
          <div className="text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#E7CFA0]">Your words matter to us</p>
            <h1 id="review-title" className="mt-4 text-4xl leading-tight sm:text-5xl" style={serif}>How was your wedding with <span className="text-[#E7CFA0]" style={script}>Shaadi Shopping</span>?</h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/80 sm:text-lg lg:mx-0">Every wedding we plan is someone’s once-in-a-lifetime day. Tell us what went well — and what we can do better.</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <a href="#write" className="inline-flex min-h-12 items-center rounded-full bg-[#E7CFA0] px-6 text-base font-semibold text-[#2A0F18] hover:bg-[#F1DDB4]">Write a review</a>
              <a href="#next" className="inline-flex min-h-12 items-center rounded-full border border-white/30 px-6 text-base font-semibold text-white hover:bg-white/10">Plan our next celebration</a>
            </div>
            {summary && (
              <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm">
                <Stars value={summary.average} /> <b>{summary.average.toFixed(1)}</b> from {summary.count} {summary.count === 1 ? 'family' : 'families'}
              </p>
            )}
          </div>

          <div data-hero-3d className="relative mx-auto h-[360px] w-full max-w-[420px] transition-transform duration-300 ease-out [transform-style:preserve-3d] sm:h-[460px]">
            <div aria-hidden className="absolute right-0 top-0 h-[calc(100%-8px)] w-[82%] rounded-t-[999px] rounded-b-[36px] border border-[#C9A86A] [transform:translateZ(-60px)_translate(14px,-14px)]" />
            <div className="absolute right-0 top-0 h-[calc(100%-24px)] w-[82%] overflow-hidden rounded-t-[999px] rounded-b-[30px] shadow-[0_30px_70px_rgba(0,0,0,0.45)] [transform:translateZ(0px)]">
              <Image src="/cat-real-weddings.jpg" alt="A wedding planned by Shaadi Shopping" fill priority sizes="(min-width: 1024px) 380px, 80vw" className="object-cover" />
            </div>
            {/* Only a real, published review — never an invented quote */}
            <div className="absolute left-0 top-10 max-w-[230px] rounded-[18px] border border-[#EADFCC] bg-white px-4 py-3 text-[#221714] shadow-[0_18px_44px_rgba(0,0,0,0.3)] [transform:translateZ(110px)]">
              {latest ? (
                <>
                  <Stars value={latest.rating} />
                  <p className="mt-1 line-clamp-2 text-sm font-semibold">“{latest.comment}”</p>
                  <p className="mt-0.5 text-xs text-[#6B5A50]">{latest.name}</p>
                </>
              ) : (
                <>
                  <Stars value={0} />
                  <p className="mt-1 text-sm font-semibold">Your story could be next</p>
                </>
              )}
            </div>
            <div className="absolute bottom-0 left-2 flex items-center gap-2.5 rounded-[18px] bg-gradient-to-br from-[#7A1238] to-[#4A0B22] px-4 py-3 text-white shadow-[0_18px_44px_rgba(0,0,0,0.35)] [transform:translateZ(80px)]">
              <Gift className="h-5 w-5 text-[#E7CFA0]" aria-hidden />
              <div>
                <p className="text-sm font-semibold">{RETURNING_OFFER.short} your next event*</p>
                <p className="text-xs text-white/75">Anniversary · Griha Pravesh · Janeu</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:py-16">
        <section id="write" data-depth aria-labelledby="write-title" className="scroll-mt-20 rounded-[26px] border border-[#E8DCC8] bg-white p-5 shadow-[0_24px_60px_rgba(34,23,20,0.08)] sm:p-8">
          <h2 id="write-title" className="text-2xl" style={serif}>Write your review</h2>
          <p className="mt-1 text-sm text-[#6B5A50]">It appears here after our team reads it. Only your first name and initial are shown.</p>
          <ReviewForm />
        </section>

        <section data-depth aria-labelledby="said">
          <h2 id="said" className="text-2xl" style={serif}>What families say</h2>
          {reviews.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-[#E2D3BC] bg-white/60 p-5 text-sm text-[#6B5A50]">Be the first to share how your wedding went.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {reviews.map((r) => (
                <li key={r.id} data-tilt className="rounded-2xl border border-[#E8DCC8] bg-white p-4 shadow-sm">
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

      <NextCelebration />
    </main>
  );
}
