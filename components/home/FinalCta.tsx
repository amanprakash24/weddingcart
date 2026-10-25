import Link from 'next/link';
import { Phone } from 'lucide-react';
import { SHAADI_PHONE, SHAADI_PHONE_DISPLAY } from '@/lib/shaadiContact';
import { btnGold, btnLight, serif } from './styles';

// Closing block, split for the two audiences: families and wedding businesses.
export default function FinalCta() {
  return (
    <section aria-label="Get started" className="bg-[linear-gradient(#F4ECDF_50%,#2A1F1B_50%)] px-4 sm:px-6">
      <div className="mx-auto grid max-w-[1240px] overflow-hidden rounded-[32px] shadow-[0_30px_80px_rgba(34,23,20,0.25)] md:grid-cols-2">
        <div className="bg-[#7A1238] px-6 py-12 text-white sm:px-12 sm:py-14">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#F3E3C3]">For families</p>
          <h2 className="mt-3 text-[2.4rem] font-semibold leading-[1.05] sm:text-[2.9rem]" style={serif}>Start with a free call</h2>
          <p className="mt-3 text-base leading-relaxed text-[#F4DCE5] sm:text-[17px]">A Wedding Expert calls you back with venues and vendors that fit your budget.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/plan" className="inline-flex min-h-[50px] items-center justify-center rounded-full bg-white px-6 text-[15px] font-bold text-[#7A1238] transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#7A1238]">
              Plan my wedding
            </Link>
            <a href={`tel:${SHAADI_PHONE}`} className={btnLight}><Phone className="h-4 w-4" aria-hidden /> {SHAADI_PHONE_DISPLAY}</a>
          </div>
        </div>
        <div className="bg-[#2A0614] px-6 py-12 text-[#FBF6EE] sm:px-12 sm:py-14">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#E9C98E]">For venues &amp; businesses</p>
          <h2 className="mt-3 text-[2.4rem] font-semibold leading-[1.05] sm:text-[2.9rem]" style={serif}>Get more wedding bookings</h2>
          <p className="mt-3 text-base leading-relaxed text-[#D9CBB8] sm:text-[17px]">List your business and run your enquiries on Vivah OS.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/vendor-onboarding" className={btnGold}>List your business</Link>
            <Link href="/vivah-os" className={btnLight}>Vivah OS</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
