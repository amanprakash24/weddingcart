'use client';

import { motion } from 'framer-motion';
import { Building2, Store, UserCheck } from 'lucide-react';
import { fadeUp, stagger } from './animations';
import { festive } from '@/lib/festive';
import { OrnamentRule } from '@/components/festive/Decor';

const VALUE_PROPS = [
  {
    icon: Building2,
    title: 'Find the Right Venue',
    desc: 'Compare venues based on date, budget & guest count.',
  },
  {
    icon: Store,
    title: 'Trusted Wedding Vendors',
    desc: 'Decorators, caterers, photographers, makeup artists & more.',
  },
  {
    icon: UserCheck,
    title: 'One Wedding Expert',
    desc: 'One dedicated expert from planning to Vidai.',
  },
];

// While the festive season is on (lib/festive.ts) the row carries the season's three plain benefits. Nothing here is a number,
// a rating or a guarantee (verified against what the business does, 14 Oct 2026) — only what Shaadi Shopping really does.
const FESTIVE_PROPS = [
  { icon: Building2, title: 'Venues & Vendors in Patna', desc: 'Venues, decorators, caterers, photographers, makeup artists and more — in one place.' },
  { icon: Store, title: 'A Clear, Written Quotation', desc: 'For your date, guest count and budget — every line set out before you decide.' },
  { icon: UserCheck, title: 'One Wedding Expert', desc: 'One person with you from planning to Vidai, a call or a WhatsApp away.' },
];

export default function ValuePropsSection() {
  const props = festive.enabled ? FESTIVE_PROPS : VALUE_PROPS;
  return (
    <section className="bg-[#FAF5EE] py-12 sm:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {festive.enabled && <OrnamentRule className="mb-9" />}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger(0.08)}
        >
          {props.map(({ icon: Icon, title, desc }) => (
            <motion.div key={title} variants={fadeUp} className="text-center sm:text-left flex flex-col items-center sm:items-start gap-2.5">
              <div className="w-11 h-11 rounded-full bg-[#8B1A4A]/8 flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#8B1A4A]" />
              </div>
              <p className="text-[#2A1F1B] font-semibold text-base sm:text-lg" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                {title}
              </p>
              <p className="text-[#6B5B4D] text-sm leading-relaxed max-w-[240px]">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
