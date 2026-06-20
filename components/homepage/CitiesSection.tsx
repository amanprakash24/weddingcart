'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  Hotel,
  Palette,
  ChefHat,
  Camera,
  Flower2,
  Leaf,
  Disc3,
  ClipboardList,
  Music2,
} from 'lucide-react';
import { fadeUp, stagger } from './animations';

const CITIES_GRID = [
  { name: 'Delhi',     slug: 'delhi',     img: 'https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=600&q=80' },
  { name: 'Mumbai',    slug: 'mumbai',    img: 'https://images.unsplash.com/photo-1502635385003-ee1e6a1a742d?w=600&q=80' },
  { name: 'Jaipur',    slug: 'jaipur',    img: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600&q=80' },
  { name: 'Bangalore', slug: 'bangalore', img: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=600&q=80' },
  { name: 'Udaipur',   slug: 'udaipur',   img: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=600&q=80' },
  { name: 'Goa',       slug: 'goa',       img: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=600&q=80' },
  { name: 'Hyderabad', slug: 'hyderabad', img: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80' },
  { name: 'Chennai',   slug: 'chennai',   img: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=600&q=80' },
  { name: 'Kolkata',   slug: 'kolkata',   img: 'https://images.unsplash.com/photo-1478146059778-26028b07395a?w=600&q=80' },
];

const PATNA_SERVICES = [
  { label: 'Wedding Venues in Patna',  href: '/cities/patna/venue',       Icon: Building2     },
  { label: 'Banquet Halls in Patna',   href: '/blog/best-banquet-halls-patna-wedding-marriage-hall', Icon: Hotel },
  { label: 'Makeup Artists in Patna',  href: '/cities/patna/makeup',      Icon: Palette       },
  { label: 'Caterers in Patna',        href: '/cities/patna/catering',    Icon: ChefHat       },
  { label: 'Photographers in Patna',   href: '/cities/patna/photo-video', Icon: Camera        },
  { label: 'Decorators in Patna',      href: '/cities/patna/decorator',   Icon: Flower2       },
  { label: 'Mehndi Artists in Patna',  href: '/cities/patna/mehndi',      Icon: Leaf          },
  { label: 'DJ Services in Patna',     href: '/cities/patna/dj',          Icon: Disc3         },
  { label: 'Wedding Planners Patna',   href: '/cities/patna/planning',    Icon: ClipboardList },
  { label: 'Bands in Patna',           href: '/cities/patna/band',        Icon: Music2        },
];

export default function CitiesSection() {
  return (
    <>
      {/* Popular Cities */}
      <section className="py-16 sm:py-24 bg-[#F8F5EF] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-10 sm:mb-14"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger(0.12)}
          >
            <motion.p variants={fadeUp} className="eyebrow-luxury mb-3">Your City. Your Wedding.</motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl sm:text-5xl font-semibold text-[#2A1F1B] leading-tight"
              style={{ fontFamily: 'var(--font-playfair, serif)' }}
            >
              We Plan Weddings Across India
            </motion.h2>
            <motion.p variants={fadeUp} className="text-[#6B5B4D] text-sm mt-4 max-w-xs mx-auto leading-relaxed">
              Expert coordination, verified vendors, and personal planning — wherever your celebration happens.
            </motion.p>
          </motion.div>

          <motion.div
            className="flex flex-col lg:flex-row gap-4"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            variants={stagger(0.08)}
          >
            {/* Patna — large featured card */}
            <motion.div variants={fadeUp} className="lg:w-[38%] flex-shrink-0">
              <Link
                href="/cities/patna"
                className="group relative flex rounded-2xl overflow-hidden min-h-[260px] lg:min-h-[420px]"
              >
                <Image
                  src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=900&q=80"
                  alt="Wedding vendors in Patna Bihar"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                  sizes="(max-width: 1024px) 100vw, 38vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1C1208]/88 via-[#1C1208]/30 to-transparent" />
                <div className="absolute top-4 left-4">
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] bg-[#C5A46D] text-white px-3 py-1.5 rounded-full shadow">
                    Featured · Bihar
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                  <p className="text-[#C5A46D] text-[10px] font-semibold tracking-[0.22em] uppercase mb-1.5">Patna, Bihar</p>
                  <h3
                    className="text-white text-2xl sm:text-3xl font-bold mb-2 leading-tight"
                    style={{ fontFamily: 'var(--font-playfair, serif)' }}
                  >
                    Plan Your<br />Patna Wedding
                  </h3>
                  <p className="text-white/60 text-xs mb-5 leading-relaxed">
                    Venues · Makeup · Catering · Decorators · SFX — all verified locally
                  </p>
                  <span className="inline-flex items-center gap-2 text-[#C5A46D] text-[11px] font-semibold tracking-[0.12em] uppercase group-hover:gap-4 transition-all duration-300">
                    Explore Patna <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            </motion.div>

            {/* Other cities grid */}
            <motion.div variants={stagger(0.06)} className="flex-1 grid grid-cols-3 gap-3">
              {CITIES_GRID.map(({ name, slug, img }) => (
                <motion.div key={slug} variants={fadeUp}>
                  <Link
                    href={`/cities/${slug}`}
                    className="group relative flex rounded-xl overflow-hidden min-h-[120px] sm:min-h-[130px]"
                  >
                    <Image
                      src={img}
                      alt={`Wedding vendors in ${name}`}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-700"
                      sizes="(max-width: 1024px) 33vw, 20vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1C1208]/80 via-[#1C1208]/15 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p
                        className="text-white text-sm font-semibold leading-tight"
                        style={{ fontFamily: 'var(--font-playfair, serif)' }}
                      >
                        {name}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Popular Searches in Patna */}
      <section className="py-12 sm:py-16 bg-white border-t border-[#C5A46D]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <p className="eyebrow-luxury mb-2">Most Searched</p>
              <h2
                className="text-2xl sm:text-3xl font-bold text-[#2A1F1B]"
                style={{ fontFamily: 'var(--font-playfair, serif)' }}
              >
                Popular Wedding Services in Patna
              </h2>
            </div>
            <Link href="/cities/patna" className="text-[#8B1A4A] text-sm font-semibold hover:underline flex-shrink-0">
              All Patna Services →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {PATNA_SERVICES.map(({ label, href, Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3 bg-[#FAF5EE] hover:bg-[#F0E8D8] border border-[#C5A46D]/15 hover:border-[#C5A46D]/40 rounded-xl px-4 py-3.5 transition-all duration-200 active:scale-[0.97]"
              >
                <Icon className="w-4 h-4 text-[#C5A46D] flex-shrink-0 group-hover:scale-110 transition-transform duration-200" />
                <span className="text-[#2A1F1B] text-xs sm:text-sm font-medium leading-tight group-hover:text-[#8B1A4A] transition-colors">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Venues */}
      <section className="py-12 sm:py-16 bg-[#FAF5EE]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#C5A46D] mb-1">Verified by ShaadiShopping</p>
              <h2
                className="text-2xl sm:text-3xl font-bold text-[#2A1F1B]"
                style={{ fontFamily: 'var(--font-playfair, serif)' }}
              >
                Featured Wedding Venues in Patna
              </h2>
            </div>
            <Link href="/cities/patna/venue" className="hidden sm:block text-[#8B1A4A] text-sm font-semibold hover:underline flex-shrink-0">
              All Venues →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Touch of Cozy */}
            <Link
              href="/lp/touch-of-cozy"
              className="group relative rounded-2xl overflow-hidden bg-white border border-[#C5A46D]/20 hover:border-[#C5A46D]/50 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80"
                  alt="Touch of Cozy banquet hall, Rajeev Nagar Patna"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute top-3 left-3 text-[9px] font-bold uppercase tracking-[0.2em] bg-[#C5A46D] text-white px-2.5 py-1 rounded-full">
                  New · Rajeev Nagar
                </span>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold text-[#2A1F1B] mb-1" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                  Touch of Cozy
                </h3>
                <p className="text-xs text-[#6B5B4D] mb-3">
                  Mica Colony, Rajeev Nagar, Patna · AC Hall · 5 Guest Rooms · In-House Catering
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#8B1A4A]">From ₹999/plate</span>
                  <span className="text-xs text-[#C5A46D] font-semibold group-hover:translate-x-1 transition-transform duration-200">
                    View Venue →
                  </span>
                </div>
              </div>
            </Link>

            {/* Swayamvar Hall */}
            <Link
              href="/lp/swayamvar-hall"
              className="group relative rounded-2xl overflow-hidden bg-white border border-[#C5A46D]/20 hover:border-[#C5A46D]/50 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80"
                  alt="Swayamvar Hall and Homestay banquet hall, Danapur Patna"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute top-3 left-3 text-[9px] font-bold uppercase tracking-[0.2em] bg-[#8B1A4A] text-white px-2.5 py-1 rounded-full">
                  Trusted · Danapur
                </span>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold text-[#2A1F1B] mb-1" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                  Swayamvar Hall &amp; Homestay
                </h3>
                <p className="text-xs text-[#6B5B4D] mb-3">
                  Gola Road, Danapur, Patna · Up to 700 Guests · Home Stay · Baraat Allowed
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#8B1A4A]">From ₹1,50,000/event</span>
                  <span className="text-xs text-[#C5A46D] font-semibold group-hover:translate-x-1 transition-transform duration-200">
                    View Venue →
                  </span>
                </div>
              </div>
            </Link>

            {/* 7 Vachan */}
            <Link
              href="/lp/7-vachan-patna"
              className="group relative rounded-2xl overflow-hidden bg-white border border-[#C5A46D]/20 hover:border-[#C5A46D]/50 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                <Image
                  src="https://content.jdmagicbox.com/v2/comp/patna/z3/0612px612.x612.250508092933.e8z3/catalogue/7-vachan-judges-colony-patna-banquet-halls-z4mw544mkw.jpg"
                  alt="7 Vachan banquet hall at night, Judges Colony Saguna Mor Patna"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute top-3 left-3 text-[9px] font-bold uppercase tracking-[0.2em] bg-[#C5A46D] text-white px-2.5 py-1 rounded-full">
                  4.6★ · Saguna Mor
                </span>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold text-[#2A1F1B] mb-1" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                  7 Vachan
                </h3>
                <p className="text-xs text-[#6B5B4D] mb-3">
                  Judges Colony, Saguna Mor, Patna · 500+ Guests · 7 Rooms · In-House DJ
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#8B1A4A]">From ₹1,100/plate</span>
                  <span className="text-xs text-[#C5A46D] font-semibold group-hover:translate-x-1 transition-transform duration-200">
                    View Venue →
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
