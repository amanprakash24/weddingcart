import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { SHAADI_PHONE, shaadiWhatsAppLink } from '@/lib/shaadiContact';
import HeroSearch from './HeroSearch';
import HeroVideo from './HeroVideo';
import { accent, eyebrow, serif } from './styles';

const WHATSAPP = shaadiWhatsAppLink('Hi, I am planning a wedding in Patna and would like help from a wedding expert.');

// First screen (A+ design): what we do, a search into the real listings, a person to talk to, and our homepage video
// in an arch. Below it, two clear ways in: families, and venues/wedding businesses.
export default function HomeHero({ services }: { services: { slug: string; name: string; href: string }[] }) {
  return (
    <section
      aria-labelledby="home-hero"
      className="relative overflow-hidden bg-[#FBF6EE] bg-[radial-gradient(1200px_600px_at_85%_10%,#F6E7D2_0%,rgba(246,231,210,0)_60%)]"
    >
      {/* Faint mandala, decoration only */}
      <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -right-36 -top-32 hidden h-[520px] w-[520px] opacity-[0.16] lg:block">
        <g fill="none" stroke="#B08A4A" strokeWidth=".6">
          <circle cx="100" cy="100" r="96" /><circle cx="100" cy="100" r="80" /><circle cx="100" cy="100" r="62" /><circle cx="100" cy="100" r="40" />
          <path d="M100 4v192M4 100h192M32 32l136 136M168 32L32 168" />
          <path d="M100 20c18 30 18 50 0 80-18-30-18-50 0-80zM100 180c18-30 18-50 0-80-18 30-18 50 0 80zM20 100c30-18 50-18 80 0-30 18-50 18-80 0zM180 100c-30-18-50-18-80 0 30 18 50 18 80 0z" />
        </g>
      </svg>

      {/* Clears the fixed announcement bar (36px) and the navbar (52 / 64 / 72px) */}
      <div className="relative mx-auto grid max-w-[1280px] items-center gap-10 px-4 pb-12 pt-[118px] sm:px-6 sm:pt-[132px] lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8 lg:pb-14 lg:pt-[150px]">
        <div className="min-w-0">
          <p className={eyebrow}>Wedding planning in Patna</p>
          <h1 id="home-hero" className="mt-4 text-[2.7rem] font-semibold leading-[1.02] tracking-[-0.015em] text-[#221714] sm:text-6xl lg:text-[4.6rem]" style={serif}>
            One person plans your wedding, <span className={accent}>from venue to vidai.</span>
          </h1>
          <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed text-[#4D3E36] sm:text-[19px]">
            Tell us your date, guests and budget. Your Wedding Expert shortlists venues and vendors, arranges visits and quotations, and stays with you till the last function. Free for families.
          </p>

          <div className="mt-8 max-w-[640px]">
            <HeroSearch services={services} />
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-[#4D3E36]">
            {['Free for families', 'One dedicated Wedding Expert', 'Real photos and prices'].map((t) => (
              <li key={t} className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-[#7A1238]" strokeWidth={2.4} aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Visual: the homepage video in a tall arch, a smaller decor arch, and the expert card */}
        <div className="relative mx-auto h-[440px] w-full max-w-[520px] sm:h-[560px] lg:h-[640px] lg:max-w-none">
          <div aria-hidden className="absolute -right-3 -top-3 hidden h-[calc(100%-4px)] w-[calc(78%+24px)] rounded-t-[999px] rounded-b-[40px] border border-[#C9A86A] sm:block" />
          <div className="absolute right-0 top-0 h-[calc(100%-28px)] w-[86%] overflow-hidden rounded-t-[999px] rounded-b-[30px] bg-[#1A0E0C] shadow-[0_30px_70px_rgba(34,23,20,0.18)] sm:w-[78%]">
            <HeroVideo />
          </div>
          <div className="absolute left-0 top-[12%] hidden h-[270px] w-[210px] overflow-hidden rounded-t-[120px] rounded-b-[20px] border-[6px] border-[#FBF6EE] shadow-[0_20px_50px_rgba(34,23,20,0.18)] sm:block lg:left-[2%]">
            <Image src="/cat-decor-flowers.jpg" alt="A wedding mandap decorated with flowers" fill sizes="210px" className="object-cover" />
          </div>
          <div className="absolute bottom-0 left-0 flex w-[min(320px,92%)] items-center gap-3.5 rounded-[20px] border border-[#EADFCC] bg-white px-4 py-3.5 shadow-[0_18px_44px_rgba(34,23,20,0.16)] sm:px-5 sm:py-4">
            <Image src="/images/anisha.jpg" alt="" width={56} height={56} className="h-14 w-14 flex-shrink-0 rounded-full border-2 border-[#E9C98E] object-cover object-top" />
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-[#221714]">Talk to a Wedding Expert</p>
              <p className="text-[13px] text-[#6B5A4E]">Mon–Sat, 10am–7pm</p>
              <div className="mt-2 flex gap-2">
                <a href={`tel:${SHAADI_PHONE}`} className="inline-flex min-h-[36px] items-center rounded-full bg-[#7A1238] px-3.5 text-[13px] font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#7A1238] focus-visible:ring-offset-2">Call</a>
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[36px] items-center rounded-full bg-[#E6F0E9] px-3.5 text-[13px] font-bold text-[#1F5C37] outline-none focus-visible:ring-2 focus-visible:ring-[#1F5C37] focus-visible:ring-offset-2">WhatsApp</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two ways in */}
      <div className="relative mx-auto grid max-w-[1280px] gap-4 px-4 pb-16 sm:px-6 md:grid-cols-2 lg:gap-5 lg:px-8 lg:pb-20">
        <Link
          href="/plan"
          className="group grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-2 rounded-[28px] border border-[#EADFCC] bg-white p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(34,23,20,0.14)] outline-none focus-visible:ring-2 focus-visible:ring-[#7A1238] focus-visible:ring-offset-2 sm:p-8"
        >
          <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#8A6A2F]">I&apos;m planning a wedding</span>
          <span aria-hidden className="row-span-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#7A1238] text-white sm:h-14 sm:w-14"><ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" /></span>
          <span className="text-[1.9rem] font-semibold leading-[1.08] text-[#221714] sm:text-4xl" style={serif}>Get a free Wedding Expert</span>
          <span className="text-[15px] leading-relaxed text-[#4D3E36]">Venues and every service in Patna, with one person handling the calls, visits and quotations.</span>
        </Link>
        <Link
          href="#for-vendors"
          className="group grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-2 rounded-[28px] bg-gradient-to-br from-[#5A0D29] to-[#2A0614] p-6 text-[#FBF6EE] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(34,23,20,0.2)] outline-none focus-visible:ring-2 focus-visible:ring-[#7A1238] focus-visible:ring-offset-2 sm:p-8"
        >
          <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#E9C98E]">I run a venue or wedding business</span>
          <span aria-hidden className="row-span-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#E9C98E] text-[#2A0614] sm:h-14 sm:w-14"><ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" /></span>
          <span className="text-[1.9rem] font-semibold leading-[1.08] sm:text-4xl" style={serif}>Get enquiries + run them on Vivah OS</span>
          <span className="text-[15px] leading-relaxed text-[#EADCCB]">List your business, receive wedding enquiries, and send quotations under your own name.</span>
        </Link>
      </div>
    </section>
  );
}
