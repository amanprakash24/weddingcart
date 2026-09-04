'use client';

import { motion } from 'framer-motion';
import { Building2, Store, UserCheck } from 'lucide-react';
import { fadeUp, stagger } from './animations';

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

export default function ValuePropsSection() {
  return (
    <section className="bg-[#FAF5EE] py-12 sm:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger(0.08)}
        >
          {VALUE_PROPS.map(({ icon: Icon, title, desc }) => (
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
