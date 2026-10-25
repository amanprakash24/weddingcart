import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import VendorCard from '@/components/VendorCard';
import type { Vendor } from '@/types';
import { PATNA_AREAS } from '@/lib/home/areas';
import { accent, btnGold, container, eyebrow, h2, sectionPad, serif } from './styles';

// Real published venues, rendered on the server, and a card for families who want a shortlist instead.
export default function VenuesByArea({ venues }: { venues: Vendor[] }) {
  return (
    <section id="venues" aria-labelledby="home-venues" className={`scroll-mt-28 bg-[#FBF6EE] ${sectionPad}`}>
      <div className={container}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={eyebrow}>Venues in Patna</p>
            <h2 id="home-venues" className={h2} style={serif}>Real venues, <span className={accent}>real prices</span></h2>
          </div>
          <Link href="/cities/patna/venue" className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-bold text-[#7A1238] underline-offset-4 hover:underline">
            See all venues <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Venues by area">
          {PATNA_AREAS.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/venues/patna/${a.slug}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#E2D3BC] bg-white px-4 text-sm font-medium text-[#221714] transition-colors hover:border-[#7A1238] hover:text-[#7A1238] outline-none focus-visible:ring-2 focus-visible:ring-[#7A1238]"
              >
                <MapPin className="h-3.5 w-3.5 text-[#8A6A2F]" aria-hidden /> {a.label}
              </Link>
            </li>
          ))}
        </ul>

        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {venues.slice(0, 5).map((v) => (
            <li key={v.id}><VendorCard vendor={v} /></li>
          ))}
          <li className="relative flex min-h-[320px] flex-col gap-4 overflow-hidden rounded-[26px] bg-[#221714] p-8 text-[#FBF6EE]">
            <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -bottom-14 -right-14 h-56 w-56 opacity-20">
              <g fill="none" stroke="#E9C98E" strokeWidth="1"><circle cx="100" cy="100" r="90" /><circle cx="100" cy="100" r="60" /><path d="M100 10v180M10 100h180" /></g>
            </svg>
            <p className="text-[2rem] font-semibold leading-[1.12]" style={serif}>Not sure which venue fits your guests and budget?</p>
            <p className="text-base leading-relaxed text-[#D9CBB8]">Tell your Wedding Expert. You get a shortlist, and we arrange the visits for you.</p>
            <Link href="/plan" className={`${btnGold} relative mt-auto self-start`}>Get a free shortlist</Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
