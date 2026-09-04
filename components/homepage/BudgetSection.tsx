'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { fadeUp, stagger } from './animations';

const BUDGET_TIERS = [
  { label: 'Under ₹5 Lakh', slug: 'under-5' },
  { label: '₹5 – 10 Lakh', slug: '5-10' },
  { label: '₹10 – 15 Lakh', slug: '10-15' },
  { label: '₹15 – 25 Lakh', slug: '15-25' },
  { label: '₹25 Lakh+', slug: '25-plus' },
];

export default function BudgetSection() {
  return (
    <section className="bg-white py-14 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-10 sm:mb-12"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger(0.1)}
        >
          <motion.p variants={fadeUp} className="eyebrow-luxury mb-2.5">Budget-First Planning</motion.p>
          <motion.h2
            variants={fadeUp}
            className="font-semibold text-[#2A1F1B] text-[1.85rem] sm:text-[2.2rem] tracking-tight leading-tight mb-3"
            style={{ fontFamily: 'var(--font-playfair, serif)' }}
          >
            Start With Your Wedding Budget
          </motion.h2>
          <motion.p variants={fadeUp} className="text-[#6B5B4D] text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            Tell us your budget, and we&apos;ll recommend the best venues and vendors that fit it.
          </motion.p>
        </motion.div>

        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          variants={stagger(0.06)}
        >
          {BUDGET_TIERS.map(({ label, slug }) => (
            <motion.div key={slug} variants={fadeUp} className={slug === '25-plus' ? 'col-span-2 sm:col-span-1' : ''}>
              <Link
                href={`/plan?budget=${slug}`}
                className="group flex flex-col items-center justify-center text-center gap-2 bg-[#FAF5EE] hover:bg-[#F0E8D8] border border-[#C5A46D]/20 hover:border-[#C5A46D]/50 rounded-2xl px-4 py-6 sm:py-7 h-full transition-all duration-200 active:scale-[0.97]"
              >
                <span className="text-2xl">💰</span>
                <span className="text-[#2A1F1B] text-sm sm:text-base font-semibold leading-tight group-hover:text-[#8B1A4A] transition-colors">
                  {label}
                </span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
