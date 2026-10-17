import Image from 'next/image';
import Link from 'next/link';
import { Clock, Phone } from 'lucide-react';
import { SHAADI_PHONE, shaadiWhatsAppLink } from '@/lib/shaadiContact';
import { btnOutline, btnPrimary, container, eyebrow, h2, sectionPad, serif } from './styles';

const WHATSAPP = shaadiWhatsAppLink('Hi, I would like to talk to a wedding expert about my wedding in Patna.');

// The real founder (same photo and name as the About page) instead of the old invented "Priya" persona.
export default function FounderSection() {
  return (
    <section aria-labelledby="home-founder" className={`bg-white ${sectionPad}`}>
      <div className={`${container} grid items-center gap-10 md:grid-cols-[minmax(0,320px)_1fr] md:gap-14`}>
        <div className="relative mx-auto aspect-[4/5] w-full max-w-[300px] overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(42,31,27,0.15)] md:max-w-none">
          <Image src="/images/anisha.jpg" alt="Anisha Kumari, founder of ShaadiShopping" fill sizes="(max-width: 768px) 300px, 320px" className="object-cover object-top" />
        </div>
        <div>
          <p className={eyebrow}>The people behind your wedding</p>
          <h2 id="home-founder" className={h2} style={serif}>Started in Patna, for families in Patna</h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--warm-brown)] sm:text-base">
            ShaadiShopping was started by Anisha Kumari with one idea: a family planning a wedding should have one person to call. Our wedding experts are based in Patna and stay with you from the first venue visit to the vidai.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--warm-brown)]">
            <Clock className="h-4 w-4 text-[var(--gold-text)]" aria-hidden /> Mon–Sat, 10am–7pm
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href={`tel:${SHAADI_PHONE}`} className={btnPrimary}><Phone className="h-4 w-4" aria-hidden /> Call a wedding expert</a>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className={btnOutline}>WhatsApp us</a>
            <Link href="/about" className="inline-flex min-h-[48px] items-center px-2 text-sm font-semibold text-[var(--maroon)] underline-offset-4 hover:underline">Read our story</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
