import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { CategoryTile } from '@/lib/home/categoryTiles';
import { container, eyebrow, h2, lede, sectionPad, serif } from './styles';

// Only services that have published vendors, with the real number of them.
export default function CategoryTiles({ tiles }: { tiles: CategoryTile[] }) {
  if (tiles.length === 0) return null;
  return (
    <section aria-labelledby="home-services" className={`bg-[var(--ivory)] ${sectionPad}`}>
      <div className={container}>
        <p className={eyebrow}>Browse by service</p>
        <h2 id="home-services" className={h2} style={serif}>Everything for the wedding, in one place</h2>
        <p className={lede}>Venues and wedding services in Patna, each with photos, packages and an enquiry form.</p>
        {/* Column count follows the number of tiles so none sits alone in the last row */}
        <ul className={`mt-10 grid grid-cols-2 gap-3 sm:gap-4 ${tiles.length % 3 === 0 ? 'lg:grid-cols-3' : tiles.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
          {tiles.map((t) => (
            <li key={t.slug}>
              <Link
                href={t.href}
                className="group relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-2xl border border-[var(--soft-sand)] bg-[var(--champagne-beige)] p-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--maroon)] focus-visible:ring-offset-2 sm:p-5"
              >
                {t.picture && (
                  <>
                    <Image src={t.picture} alt="" fill sizes="(max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                    <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  </>
                )}
                <span className="relative">
                  <span className={`block text-lg leading-tight sm:text-xl ${t.picture ? 'text-white' : 'text-[var(--deep-dark)]'}`} style={serif}>{t.name}</span>
                  <span className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold sm:text-sm ${t.picture ? 'text-white/85' : 'text-[var(--warm-brown)]'}`}>
                    {t.count} in Patna <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
