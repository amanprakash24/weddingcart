'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search } from 'lucide-react';
import { PATNA_AREAS } from '@/lib/home/areas';

type Option = { slug: string; name: string; href: string };

// Service + (for venues) area → the existing listing pages. No new search backend.
// The shortlist link opens the full planning form (/plan), which saves date, guests and budget.
export default function HeroSearch({ services }: { services: Option[] }) {
  const router = useRouter();
  const [service, setService] = useState(services.find((s) => s.slug === 'venue')?.slug ?? services[0]?.slug ?? '');
  const [area, setArea] = useState('');

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (service === 'venue' && area) {
      router.push(`/venues/patna/${area}`);
      return;
    }
    router.push(services.find((s) => s.slug === service)?.href ?? '/cities/patna/venue');
  };

  const label = 'flex min-w-0 flex-col gap-0.5 rounded-2xl bg-[#FBF6EE] px-4 py-2.5 focus-within:ring-2 focus-within:ring-[#7A1238]/30';
  const caption = 'text-[11px] font-bold uppercase tracking-[0.1em] text-[#6B5A4E]';
  const select = 'min-h-[30px] w-full min-w-0 bg-transparent text-base text-[#221714] outline-none disabled:text-[#6B5A4E]';

  return (
    <div className="rounded-3xl border border-[#EADFCC] bg-white p-3 shadow-[0_18px_50px_rgba(34,23,20,0.10)]">
      {services.length > 0 && (
        <form onSubmit={go} role="search" aria-label="Find wedding venues and vendors in Patna" className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <label className={label}>
            <span className={caption}>Looking for</span>
            <select value={service} onChange={(e) => setService(e.target.value)} className={select}>
              {services.map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            <span className={caption}>Area in Patna</span>
            <select value={service === 'venue' ? area : ''} onChange={(e) => setArea(e.target.value)} disabled={service !== 'venue'} className={select}>
              <option value="">{service === 'venue' ? 'Any area' : 'All of Patna'}</option>
              {PATNA_AREAS.map((a) => (
                <option key={a.slug} value={a.slug}>{a.label}</option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#7A1238] px-7 text-base font-bold text-white transition-colors hover:bg-[#5A0D29] outline-none focus-visible:ring-2 focus-visible:ring-[#7A1238] focus-visible:ring-offset-2"
          >
            <Search className="h-4 w-4" aria-hidden /> Search
          </button>
        </form>
      )}
      <div className={`flex flex-wrap items-center justify-between gap-2 px-2 ${services.length > 0 ? 'mt-3 border-t border-[#F0E6D6] pt-3' : 'py-1'}`}>
        <span className="text-[14px] text-[#6B5A4E]">Not sure yet? A Wedding Expert can shortlist for you.</span>
        <Link href="/plan" className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-bold text-[#7A1238] underline-offset-4 hover:underline">
          Get my free shortlist <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
