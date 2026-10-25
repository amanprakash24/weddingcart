import Image from 'next/image';
import Link from 'next/link';
import { Phone } from 'lucide-react';
import { SHAADI_PHONE, shaadiWhatsAppLink } from '@/lib/shaadiContact';
import { accent, btnOutline, btnPrimary, container, eyebrow, h2, sectionPad, serif } from './styles';

const WHATSAPP = shaadiWhatsAppLink('Hi, I would like to talk to a wedding expert about my wedding in Patna.');

// The real founder (same photo and name as the About page).
export default function FounderSection() {
  return (
    <section id="about" aria-labelledby="home-founder" className={`scroll-mt-28 bg-[#FBF6EE] ${sectionPad}`}>
      <div className={`${container} grid items-center gap-12 md:grid-cols-[minmax(0,400px)_1fr] md:gap-16`}>
        <div className="relative mx-auto w-full max-w-[340px] md:max-w-none">
          <div aria-hidden className="absolute inset-0 translate-x-4 translate-y-4 rounded-t-[220px] rounded-b-[26px] border border-[#C9A86A]" />
          <div className="relative aspect-[4/5] overflow-hidden rounded-t-[220px] rounded-b-[26px]">
            <Image src="/images/anisha.jpg" alt="Anisha Kumari, founder of Shaadi Shopping" fill sizes="(max-width: 768px) 340px, 400px" className="object-cover object-top" />
          </div>
        </div>
        <div>
          <p className={eyebrow}>The people behind your wedding</p>
          <h2 id="home-founder" className={h2} style={serif}>Started in Patna, <span className={accent}>for families in Patna</span></h2>
          <p className="mt-6 text-[1.7rem] italic leading-snug text-[#221714] sm:text-[2rem]" style={serif}>
            &ldquo;A family planning a wedding should have one person to call.&rdquo;
          </p>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[#4D3E36] sm:text-lg">
            That was the idea when Anisha Kumari started Shaadi Shopping. Our Wedding Experts are based in Patna and stay with you from the first visit to the vidai.
          </p>
          <p className="mt-4 font-bold text-[#7A1238]">Anisha Kumari · Founder</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href={`tel:${SHAADI_PHONE}`} className={btnPrimary}><Phone className="h-4 w-4" aria-hidden /> Call a Wedding Expert</a>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className={btnOutline}>WhatsApp us</a>
            <Link href="/about" className="inline-flex min-h-[50px] items-center px-2 text-[15px] font-bold text-[#7A1238] underline-offset-4 hover:underline">Read our story</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
