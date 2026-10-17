import { ChevronDown } from 'lucide-react';
import { HOME_FAQ } from '@/lib/home/faq';
import { eyebrow, h2, sectionPad, serif } from './styles';

// Visible FAQ — the same text app/page.tsx sends to Google as FAQPage data. Works without JavaScript.
export default function HomeFaq() {
  return (
    <section aria-labelledby="home-faq" className={`bg-[var(--ivory)] ${sectionPad}`}>
      <div className="mx-auto max-w-3xl">
        <p className={eyebrow}>Questions couples ask</p>
        <h2 id="home-faq" className={h2} style={serif}>Good to know before you start</h2>
        <div className="mt-8 divide-y divide-[var(--soft-sand)] rounded-2xl border border-[var(--soft-sand)] bg-white">
          {HOME_FAQ.map((f) => (
            <details key={f.q} className="group px-5 sm:px-6">
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-semibold text-[var(--deep-dark)] outline-none focus-visible:text-[var(--maroon)] [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-[var(--gold-text)] transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-[var(--warm-brown)]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
