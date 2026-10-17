import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { container, eyebrow, h2, lede, sectionPad, serif } from './styles';

// Same budget bands and links as before (/plan?budget=<slug>, read by the plan page), without the scroll
// animation that left the section blank until it was scrolled into view.
const BANDS = [
  { label: 'Under ₹5 lakh', slug: 'under-5' },
  { label: '₹5 – 10 lakh', slug: '5-10' },
  { label: '₹10 – 15 lakh', slug: '10-15' },
  { label: '₹15 – 25 lakh', slug: '15-25' },
  { label: '₹25 lakh+', slug: '25-plus' },
];

export default function BudgetBands() {
  return (
    <section aria-labelledby="home-budget" className={`bg-white ${sectionPad}`}>
      <div className={container}>
        <p className={eyebrow}>Plan by budget</p>
        <h2 id="home-budget" className={h2} style={serif}>Start with your wedding budget</h2>
        <p className={lede}>Pick a range and tell us a little more. We suggest venues and vendors that fit it.</p>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {BANDS.map((b, i) => (
            <li key={b.slug} className={i === BANDS.length - 1 ? 'col-span-2 sm:col-span-1' : ''}>
              <Link
                href={`/plan?budget=${b.slug}`}
                className="group flex min-h-[64px] items-center justify-between gap-2 rounded-2xl border border-[var(--soft-sand)] bg-[var(--ivory)] px-4 text-[15px] font-semibold text-[var(--deep-dark)] transition-colors hover:border-[var(--maroon)]/50 hover:text-[var(--maroon)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--maroon)]"
              >
                {b.label}
                <ArrowRight className="h-4 w-4 text-[var(--gold-text)] transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
