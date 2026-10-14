'use client';

import React from 'react';
import { motion } from 'framer-motion';
import CountUpStat from './CountUpStat';
import { stagger } from './animations';

const TRUST_STATS = [
  { end: 10000, suffix: '+', label: 'Couples Served' },
  { end: 500,   suffix: '+', label: 'Verified Vendors' },
  { end: 25,    suffix: '+', label: 'Cities Covered' },
  { end: 5,     suffix: '',  label: 'Dedicated Experts' },
];

export default function TrustStats() {
  return (
    <div className="bg-[#FFFCF7] border-b border-[#C5A46D]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0 lg:divide-x lg:divide-[#C5A46D]/12"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={stagger(0.1)}
        >
          {TRUST_STATS.map(({ end, suffix, label }) => (
            <CountUpStat key={label} end={end} suffix={suffix} label={label} />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
