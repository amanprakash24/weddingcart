'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { fadeUp, stagger } from './animations';
import { festive } from '@/lib/festive';
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

// The category's own picture. If its address no longer answers (two of the stored pictures were dead links on 14 Oct 2026), the
// card keeps a warm burgundy-and-gold ground instead of a broken-image mark.
function CategoryPicture({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) return <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#C5A46D33,transparent_55%),linear-gradient(160deg,#6B1238,#2A0614)]" />;
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes="(min-width: 1024px) 25vw, 50vw"
      onError={() => setFailed(true)}
      className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
    />
  );
}

export default function CategoriesSection({ categories }: { categories: HomeCategory[] }) {
  if (categories.length === 0) return null;
  return (
    <section aria-labelledby="home-categories" className="bg-[#FFFAF5] px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#B08D55]">Everything for the wedding</p>
          <h2 id="home-categories" className="mt-4 text-3xl leading-tight text-[#2A1F1B] sm:text-[42px]" style={serif}>
            Explore Wedding Categories
          </h2>
          <p className="mt-3 font-cormorant text-xl italic text-[#8B1A4A]">From the venue to the last song of the night.</p>
          {festive.enabled && <OrnamentRule className="mt-6" />}
        </div>

        <motion.ul
          className="mt-10 grid grid-cols-2 gap-3 sm:mt-14 sm:gap-5 lg:grid-cols-4"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger(0.06)}
        >
          {categories.map((c) => (
            <motion.li key={c.slug} variants={fadeUp}>
              <Link
                href={`/cities/patna/${c.slug}`}
                className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-[#2A1F1B] shadow-[0_14px_40px_rgba(42,6,20,0.10)] outline-none ring-[#C5A46D] ring-offset-2 ring-offset-[#FFFAF5] focus-visible:ring-2 sm:rounded-[22px]"
              >
                <CategoryPicture src={c.image} />
                <span className="absolute inset-0 bg-gradient-to-t from-[#1E0510]/85 via-[#1E0510]/15 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 sm:p-5">
                  <span className="text-lg leading-snug text-white sm:text-xl" style={serif}>{c.name}</span>
                  <span className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[#C5A46D]/60 text-[#E9C98A] transition-colors group-hover:bg-[#C5A46D] group-hover:text-[#2A1F1B]">
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </span>
              </Link>
            </motion.li>
          ))}
        </motion.ul>

        <div className="mt-10 text-center">
          <Link href="/vendors" className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-[#8B1A4A]/30 px-7 text-sm font-semibold text-[#8B1A4A] transition-colors hover:bg-[#8B1A4A] hover:text-white">
            See all wedding vendors <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
