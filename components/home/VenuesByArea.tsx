import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import VendorCard from '@/components/VendorCard';
import type { Vendor } from '@/types';
import { PATNA_AREAS } from '@/lib/home/areas';
import { container, eyebrow, h2, lede, sectionPad, serif } from './styles';

// Real published venues, rendered on the server (the old "featured vendors" loaded in the browser after the page).
export default function VenuesByArea({ venues }: { venues: Vendor[] }) {
  return (
    <section aria-labelledby="home-venues" className={`bg-[var(--champagne-beige)]/45 ${sectionPad}`}>
      <div className={container}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={eyebrow}>Wedding venues</p>
            <h2 id="home-venues" className={h2} style={serif}>Find a venue near you in Patna</h2>
            <p className={lede}>Banquet halls, lawns and resorts. Open a venue for photos, capacity and prices.</p>
          </div>
          <Link href="/cities/patna/venue" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[var(--maroon)] underline-offset-4 hover:underline">
            See all venues <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Venues by area">
          {PATNA_AREAS.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/venues/patna/${a.slug}`}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[var(--maroon)]/20 bg-white px-4 text-sm font-medium text-[var(--deep-dark)] transition-colors hover:border-[var(--maroon)] hover:text-[var(--maroon)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--maroon)]"
              >
                <MapPin className="h-3.5 w-3.5 text-[var(--gold-text)]" aria-hidden /> {a.label}
              </Link>
            </li>
          ))}
        </ul>

        {venues.length > 0 && (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((v) => (
              <li key={v.id}><VendorCard vendor={v} /></li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
