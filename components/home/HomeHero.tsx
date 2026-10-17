import Image from 'next/image';
import { Check, Phone } from 'lucide-react';
import { SHAADI_PHONE, SHAADI_PHONE_DISPLAY, shaadiWhatsAppLink } from '@/lib/shaadiContact';
import HeroSearch from './HeroSearch';
import { serif } from './styles';

const WHATSAPP = shaadiWhatsAppLink('Hi, I am planning a wedding in Patna and would like help from a wedding expert.');

// The first screen: what we do, a search into the existing listings, and a person to talk to.
// A still photo, not the old 9 MB video, so the first screen loads quickly on a phone. Text is visible at once.
export default function HomeHero({ services }: { services: { slug: string; name: string; href: string }[] }) {
  return (
    <section className="relative isolate overflow-hidden bg-[#1C0A12]">
      <Image
        src="/images/hero-bg.jpg"
        alt="A bride's and groom's hands joined during the kanyadaan, with marigolds"
        fill
        priority
        sizes="100vw"
        className="-z-10 object-cover object-[60%_center]"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-[#1C0A12]/85 via-[#1C0A12]/70 to-[#1C0A12]/90 sm:bg-gradient-to-r sm:from-[#1C0A12]/92 sm:via-[#1C0A12]/72 sm:to-[#1C0A12]/25" />

      {/* Clears the fixed announcement bar (36px) and the navbar */}
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-[124px] sm:px-6 sm:pb-20 sm:pt-[150px] lg:pb-28 lg:pt-[170px]">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--gold-light)]">Wedding planning in Patna</p>
          <h1 className="mt-4 text-[2.15rem] leading-[1.12] text-white sm:text-5xl lg:text-[3.6rem]" style={serif}>
            Plan your wedding with one expert, from venue to vidai.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
            Tell us your date, guests and budget. We shortlist venues and vendors in Patna, arrange visits and quotations, and stay with you until the vidai.
          </p>

          <div className="mt-8">
            <HeroSearch services={services} />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-white/85">
            <span className="font-semibold text-white">Or talk to us:</span>
            <a href={`tel:${SHAADI_PHONE}`} className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-white underline-offset-4 hover:underline">
              <Phone className="h-4 w-4" aria-hidden /> {SHAADI_PHONE_DISPLAY}
            </a>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-white underline-offset-4 hover:underline">
              WhatsApp
            </a>
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
            {['Free for couples', 'One dedicated wedding expert', 'Based in Patna'].map((t) => (
              <li key={t} className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-[var(--gold-light)]" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
