import type { CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import { HOME_FAQ } from '@/lib/home/faq';
import { shaadiWhatsAppLink } from '@/lib/shaadiContact';
import HowDepth from './HowDepth';
import s3 from './home3d.module.css';
import { eyebrow, h2, serif } from './styles';

const WHATSAPP = shaadiWhatsAppLink('Hi, I have a question about Shaadi Shopping.');

// Visible FAQ — the same text app/page.tsx sends to Google as FAQPage data. Works without JavaScript.
// In 3D (19 Nov 2026): the question cards fall into place one after another, the open one lifts forward and its answer
// unfolds, and a gold "?" medallion turns as the section scrolls in (--q, driven by HowDepth).
const FAQ_VARS = [{ sel: '[data-faq-list]', name: '--q', start: 0.95, span: 0.55 }];
export default function HomeFaq() {
  return (
    <section id="faq" aria-labelledby="home-faq" className={`${s3.faq} overflow-hidden bg-[#F4ECDF] px-4 py-16 sm:px-6 sm:py-24`}>
      <div className="mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-14">
        <div>
          <span aria-hidden className={`${s3.faqMark} mb-8`} style={serif}>?</span>
          <p className={eyebrow}>Questions</p>
          <h2 id="home-faq" className={h2} style={serif}>Good to know</h2>
          <p className="mt-4 text-base leading-relaxed text-[#4D3E36]">
            Still unsure?{' '}
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="font-bold text-[#7A1238] underline-offset-4 hover:underline">Ask us on WhatsApp</a>.
          </p>
        </div>
        <div data-faq-list className={`${s3.faqList} space-y-2.5`} style={{ '--n': HOME_FAQ.length } as CSSProperties}>
          {HOME_FAQ.map((f, i) => (
            <details key={f.q} open={i === 0} style={{ '--i': i } as CSSProperties} className={`${s3.faqItem} group rounded-[18px] border border-[#E2D3BC] bg-white px-5 sm:px-6`}>
              <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-bold text-[#221714] outline-none focus-visible:text-[#7A1238] [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-[#8A6A2F] transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="pb-5 text-[15px] leading-relaxed text-[#4D3E36]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
      <HowDepth sectionId="faq" vars={FAQ_VARS} />
    </section>
  );
}
