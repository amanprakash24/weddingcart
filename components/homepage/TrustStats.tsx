'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { fadeUp, stagger } from './animations';

// Four plain facts about Shaadi Shopping. Until 14 Oct 2026 this row showed "10,000+ Couples Served", "500+ Verified Vendors",
// "25+ Cities Covered" and "5 Dedicated Experts" — numbers nothing in the business or the database supported (there were about a
// dozen published vendors). Only what is true is shown here now; the one number is counted from the database by app/page.tsx.
// If real figures exist later, put them back here with their source.
export default function TrustStats({ categoryCount = 0 }: { categoryCount?: number }) {
  const facts = [
    { big: 'Patna', label: 'Where we plan weddings today' },
    { big: 'One', label: 'Wedding expert, planning to Vidai' },
    ...(categoryCount > 0 ? [{ big: String(categoryCount), label: 'Wedding categories to explore' }] : []),
    { big: 'Free', label: 'First consultation' },
  ];
  const columns = facts.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3';
  return (
    <div className="bg-[#FFFCF7] border-b border-[#C5A46D]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <motion.div
          className={`grid grid-cols-2 gap-8 lg:gap-0 lg:divide-x lg:divide-[#C5A46D]/12 ${columns}`}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={stagger(0.1)}
        >
          {facts.map(({ big, label }) => (
            <motion.div key={label} variants={fadeUp} className="text-center lg:px-10">
              <p className="font-cormorant text-4xl sm:text-5xl lg:text-6xl font-light text-[#8B1A4A] leading-none mb-2">{big}</p>
              <p className="text-gray-500 text-[0.58rem] sm:text-[0.7rem] tracking-[0.1em] sm:tracking-[0.2em] uppercase">{label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
