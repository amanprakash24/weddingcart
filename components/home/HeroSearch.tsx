'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { PATNA_AREAS } from '@/lib/home/areas';

type Option = { slug: string; name: string; href: string };

// Service + (for venues) area → the existing listing pages. No new search backend.
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

  if (services.length === 0) return null;
  const field =
    'h-12 w-full min-w-0 rounded-xl border border-[var(--soft-sand)] bg-white px-3 text-[15px] text-[var(--deep-dark)] outline-none focus-visible:border-[var(--maroon)] focus-visible:ring-2 focus-visible:ring-[var(--maroon)]/25';

  return (
    <form
      onSubmit={go}
      role="search"
      aria-label="Find wedding venues and vendors in Patna"
      className="grid gap-2 rounded-2xl bg-white/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.25)] sm:grid-cols-[1.2fr_1fr_auto]"
    >
      <label className="sr-only" htmlFor="hero-service">What are you looking for?</label>
      <select id="hero-service" value={service} onChange={(e) => setService(e.target.value)} className={field}>
        {services.map((s) => (
          <option key={s.slug} value={s.slug}>{s.name}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor="hero-area">Area in Patna</label>
      <select
        id="hero-area"
        value={service === 'venue' ? area : ''}
        onChange={(e) => setArea(e.target.value)}
        disabled={service !== 'venue'}
        className={`${field} disabled:bg-[var(--champagne-beige)]/50 disabled:text-[var(--warm-brown)]`}
      >
        <option value="">{service === 'venue' ? 'Any area in Patna' : 'All of Patna'}</option>
        {PATNA_AREAS.map((a) => (
          <option key={a.slug} value={a.slug}>{a.label}</option>
        ))}
      </select>
      <button
        type="submit"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--maroon)] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--maroon-dark)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--maroon)] focus-visible:ring-offset-2"
      >
        <Search className="h-4 w-4" aria-hidden /> Search
      </button>
    </form>
  );
}
