import Link from 'next/link';
import { ArrowRight, Phone } from 'lucide-react';
import { SHAADI_PHONE, SHAADI_PHONE_DISPLAY } from '@/lib/shaadiContact';
import { btnLight, serif } from './styles';

export default function FinalCta() {
  return (
    <section aria-labelledby="home-final" className="bg-[var(--maroon)] px-4 py-16 text-center sm:px-6 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <h2 id="home-final" className="text-[1.9rem] leading-tight text-white sm:text-[2.5rem]" style={serif}>Start with a free call</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-white/85 sm:text-base">
          Tell us about your wedding. A wedding expert will call you back and suggest venues and vendors that fit your budget.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/plan"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-[var(--maroon)] transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--maroon)]"
          >
            Begin your wedding journey <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <a href={`tel:${SHAADI_PHONE}`} className={btnLight}><Phone className="h-4 w-4" aria-hidden /> {SHAADI_PHONE_DISPLAY}</a>
        </div>
      </div>
    </section>
  );
}
