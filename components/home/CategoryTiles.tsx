import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { categoryHref, type CategoryTile } from '@/lib/home/categoryTiles';
import { accent, container, eyebrow, h2, sectionPad, serif } from './styles';

// Services for the "everything else" card; the ones already shown as photo tiles are left out.
const MORE = [
  { slug: 'catering', name: 'Catering' },
  { slug: 'band', name: 'Band & Music' },
  { slug: 'dj', name: 'DJ' },
  { slug: 'mehndi', name: 'Mehndi' },
  { slug: 'planning', name: 'Pandits & Planners' },
  { slug: 'transport', name: 'Transport' },
  { slug: 'invitations', name: 'Invitations' },
];

// Only services that have published vendors, with the real number of them. A+ layout on large screens:
// the first service large, three beside it, and a card linking to the rest.
export default function CategoryTiles({ tiles }: { tiles: CategoryTile[] }) {
  if (tiles.length === 0) return null;
  // Services with a photo take the photo tiles first; the rest are still linked from the card below.
  const shown = [...tiles.filter((t) => t.picture), ...tiles.filter((t) => !t.picture)].slice(0, 4);
  const more = MORE.filter((m) => !shown.some((t) => t.slug === m.slug));
  const bento = shown.length === 4;

  return (
    <section id="services" aria-labelledby="home-services" className={`scroll-mt-28 bg-[#FBF6EE] ${sectionPad}`}>
      <div className={container}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={eyebrow}>Browse by service</p>
            <h2 id="home-services" className={h2} style={serif}>Everything for the wedding, <span className={accent}>in one place</span></h2>
          </div>
          <Link href="/cities/patna" className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-bold text-[#7A1238] underline-offset-4 hover:underline">
            All services <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <ul className={`mt-10 grid grid-cols-2 gap-3 sm:gap-4 ${bento ? 'lg:grid-cols-[1.3fr_1fr_1fr] lg:grid-rows-[280px_280px]' : 'lg:grid-cols-4'}`}>
          {shown.map((t, i) => {
            const big = bento && i === 0;
            return (
              <li key={t.slug} className={big ? 'col-span-2 lg:col-span-1 lg:row-span-2' : ''}>
                <Link
                  href={t.href}
                  className={`group relative flex h-full flex-col justify-end overflow-hidden rounded-[26px] border border-[#EADFCC] bg-[#F4ECDF] p-5 outline-none focus-visible:ring-2 focus-visible:ring-[#7A1238] focus-visible:ring-offset-2 sm:p-6 ${big ? 'min-h-[300px]' : 'min-h-[200px] sm:min-h-[240px]'}`}
                >
                  {t.picture && (
                    <>
                      <Image src={t.picture} alt="" fill sizes={big ? '(max-width: 1024px) 100vw, 40vw' : '(max-width: 1024px) 50vw, 25vw'} className="object-cover transition-transform duration-700 group-hover:scale-105" />
                      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#140A08]/80 via-[#140A08]/20 to-transparent" />
                    </>
                  )}
                  <span className="relative">
                    <span className={`block font-semibold leading-tight ${big ? 'text-[2.4rem] sm:text-[2.8rem]' : 'text-[1.6rem] sm:text-[1.9rem]'} ${t.picture ? 'text-white' : 'text-[#221714]'}`} style={serif}>{t.name}</span>
                    <span className={`mt-1 inline-flex items-center gap-1 text-sm font-semibold ${t.picture ? 'text-[#F1E6D6]' : 'text-[#4D3E36]'}`}>
                      {t.count} in Patna <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                    {big && <span className="mt-4 hidden w-fit rounded-full bg-white px-4 py-2 text-sm font-bold text-[#7A1238] sm:block">Explore {t.name.toLowerCase()} →</span>}
                  </span>
                </Link>
              </li>
            );
          })}
          {bento && more.length > 0 && (
            <li>
              <div className="flex h-full flex-col gap-3 rounded-[26px] border border-[#E2D3BC] bg-[#F4ECDF] p-5 sm:p-6">
                <p className="text-[1.6rem] font-semibold text-[#221714]" style={serif}>And everything else</p>
                <ul className="flex flex-wrap gap-2">
                  {more.map((m) => (
                    <li key={m.slug}>
                      <Link href={categoryHref(m.slug)} className="inline-flex min-h-[44px] items-center rounded-full border border-[#E2D3BC] bg-white px-4 text-[15px] text-[#221714] transition-colors hover:border-[#7A1238] hover:text-[#7A1238] outline-none focus-visible:ring-2 focus-visible:ring-[#7A1238]">
                        {m.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
