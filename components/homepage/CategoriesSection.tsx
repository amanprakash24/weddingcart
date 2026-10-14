'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { fadeUp, stagger } from './animations';
import { festive } from '@/lib/festive';
import { trackEvent } from '@/lib/analytics/events';
import { OrnamentRule } from '@/components/festive/Decor';

// "Explore Wedding Categories" — the categories that really exist, read from the database by the homepage (app/page.tsx): each
// card is a category that has vendors today, with the category's own picture, and opens that category's page. Nothing is listed
// here by hand; with no categories the section is not shown at all.
export interface HomeCategory {
  slug: string;
  name: string;
  image: string;
}

const serif = { fontFamily: 'var(--font-playfair), serif' };
// A clear outline for people moving through the page with a keyboard.
const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-[#8B1A4A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFAF5]';

// One category card. The homepage only sends categories whose picture loaded when the page was built (app/page.tsx); if a
// picture still fails in the visitor's browser, the whole card is taken away rather than left as a broken image.
function CategoryCard({ c, wide }: { c: HomeCategory; wide: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <motion.li variants={fadeUp}>
      <Link
        href={`/cities/patna/${c.slug}`}
        onClick={() => trackEvent('home_category_click', { location: 'homepage', category: c.slug })}
        className={`group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-[#2A1F1B] shadow-[0_14px_40px_rgba(42,6,20,0.10)] sm:rounded-[22px] ${focusRing}`}
      >
        <Image
          src={c.image}
          alt=""
          fill
          sizes={wide ? '(min-width: 1024px) 33vw, 50vw' : '(min-width: 1024px) 25vw, 50vw'}
          onError={() => setFailed(true)}
          className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-[#1E0510]/90 via-[#1E0510]/20 to-transparent" />
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 sm:p-5">
          <span className="text-lg leading-snug text-white sm:text-xl" style={serif}>{c.name}</span>
          <span className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[#C5A46D]/60 text-[#E9C98A] transition-colors group-hover:bg-[#C5A46D] group-hover:text-[#2A1F1B]">
            <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        </span>
      </Link>
    </motion.li>
  );
}

export default function CategoriesSection({ categories }: { categories: HomeCategory[] }) {
  if (categories.length === 0) return null;
  // Six or fewer cards sit three to a row on a laptop, so the last row is never left half empty.
  const wide = categories.length <= 6;
  return (
    <section aria-labelledby="home-categories" className="bg-[#FFFAF5] px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#8A6A2F]">Everything for the wedding</p>
          <h2 id="home-categories" className="mt-4 text-3xl leading-tight text-[#2A1F1B] sm:text-[42px]" style={serif}>
            Explore Wedding Categories
          </h2>
          <p className="mt-3 font-cormorant text-xl italic text-[#8B1A4A]">From the venue to the last song of the night.</p>
          {festive.enabled && <OrnamentRule className="mt-6" />}
        </div>

        <motion.ul
          className={`mt-10 grid grid-cols-2 gap-3 sm:mt-14 sm:gap-5 ${wide ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger(0.06)}
        >
          {categories.map((c) => <CategoryCard key={c.slug} c={c} wide={wide} />)}
        </motion.ul>

        <div className="mt-10 text-center">
          <Link href="/vendors" className={`inline-flex min-h-[48px] items-center gap-2 rounded-full border border-[#8B1A4A]/30 px-7 text-sm font-semibold text-[#8B1A4A] transition-colors hover:bg-[#8B1A4A] hover:text-white ${focusRing}`}>
            See all wedding vendors <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
